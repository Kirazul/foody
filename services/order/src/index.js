import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { DatabaseSync } from 'node:sqlite';
import jwt from 'jsonwebtoken';
import { Kafka } from 'kafkajs';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.ORDER_SERVICE_PORT || 5002;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const PROTO_PATH = path.join(__dirname, '../../..', 'proto/foody.proto');

// --- Database Setup ---
mkdirSync(path.join(__dirname, '../.data'), { recursive: true });
const db = new DatabaseSync(path.join(__dirname, '../.data/orders.sqlite'));
db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    restaurant TEXT NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    delivery_address TEXT NOT NULL,
    driver_id TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// --- Kafka ---
const kafka = new Kafka({ clientId: 'order-service', brokers: [KAFKA_BROKER] });
let producer;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function connectKafka() {
  // Connect producer
  try {
    producer = kafka.producer({ allowAutoTopicCreation: true });
    await producer.connect();
    console.log('[order-service] Kafka producer connected');
  } catch (err) {
    console.warn('[order-service] Kafka producer failed:', err.message);
    producer = null;
    return;
  }

  // Connect consumer with retry
  connectConsumer();
}

async function connectConsumer() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const consumer = kafka.consumer({ groupId: 'order-service-group', allowAutoTopicCreation: true });
      await consumer.connect();
      await consumer.subscribe({ topic: 'delivery.status.updated', fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ message }) => {
          const event = JSON.parse(message.value.toString());
          db.prepare('UPDATE orders SET status = ?, driver_id = ?, updated_at = ? WHERE id = ?')
            .run(event.status, event.driver_name || '', new Date().toISOString(), event.order_id);
          console.log(`[order-service] Order ${event.order_id} updated to: ${event.status}`);
        }
      });
      console.log('[order-service] Kafka consumer connected');
      return;
    } catch (err) {
      console.log(`[order-service] Consumer attempt ${attempt}/30 failed: ${err.message}`);
      await sleep(3000);
    }
  }
  console.warn('[order-service] Consumer gave up after 30 attempts');
}

async function publishEvent(topic, data) {
  if (!producer) return;
  try {
    await producer.send({
      topic,
      messages: [{ key: data.id || randomUUID(), value: JSON.stringify(data) }]
    });
  } catch (err) {
    console.warn('[order-service] Failed to publish:', err.message);
  }
}

// --- Helpers ---
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

function rowToOrder(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    restaurant: row.restaurant,
    items: JSON.parse(row.items),
    total: row.total,
    status: row.status,
    delivery_address: row.delivery_address,
    driver_id: row.driver_id || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// --- gRPC Implementation ---
const orderService = {
  CreateOrder: async (call, callback) => {
    try {
      const { token, restaurant, items, delivery_address } = call.request;
      const user = verifyToken(token);
      if (!user) return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Invalid token' });
      if (!restaurant || !items.length || !delivery_address) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Restaurant, items and address required' });
      }

      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const now = new Date().toISOString();
      const order = {
        id: randomUUID(),
        user_id: user.id,
        restaurant,
        items: JSON.stringify(items),
        total: Math.round(total * 100) / 100,
        status: 'pending',
        delivery_address,
        driver_id: '',
        created_at: now,
        updated_at: now
      };

      db.prepare('INSERT INTO orders (id, user_id, restaurant, items, total, status, delivery_address, driver_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(order.id, order.user_id, order.restaurant, order.items, order.total, order.status, order.delivery_address, order.driver_id, order.created_at, order.updated_at);

      // Publish event: new order created → Delivery Service will pick it up
      await publishEvent('order.created', {
        id: order.id,
        user_id: order.user_id,
        restaurant: order.restaurant,
        delivery_address: order.delivery_address,
        total: order.total,
        timestamp: now
      });

      callback(null, { ...order, items });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  GetOrder: (call, callback) => {
    const user = verifyToken(call.request.token);
    if (!user) return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Invalid token' });

    const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(call.request.order_id, user.id);
    if (!row) return callback({ code: grpc.status.NOT_FOUND, message: 'Order not found' });

    callback(null, rowToOrder(row));
  },

  ListOrders: (call, callback) => {
    const user = verifyToken(call.request.token);
    if (!user) return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Invalid token' });

    const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
    callback(null, { orders: rows.map(rowToOrder) });
  },

  UpdateOrderStatus: (call, callback) => {
    const { order_id, status } = call.request;
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    if (!row) return callback({ code: grpc.status.NOT_FOUND, message: 'Order not found' });

    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), order_id);

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    callback(null, rowToOrder(updated));
  },

  CancelOrder: (call, callback) => {
    const user = verifyToken(call.request.token);
    if (!user) return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Invalid token' });

    const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(call.request.order_id, user.id);
    if (!row) return callback({ code: grpc.status.NOT_FOUND, message: 'Order not found' });
    if (row.status !== 'pending') {
      return callback({ code: grpc.status.FAILED_PRECONDITION, message: 'Can only cancel pending orders' });
    }

    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
      .run('cancelled', new Date().toISOString(), call.request.order_id);

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(call.request.order_id);
    callback(null, rowToOrder(updated));
  }
};

// --- Start ---
async function main() {
  await connectKafka();

  const packageDef = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true });
  const proto = grpc.loadPackageDefinition(packageDef).foody;

  const server = new grpc.Server();
  server.addService(proto.OrderService.service, orderService);

  server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) { console.error(err); process.exit(1); }
    console.log(`[order-service] gRPC server running on port ${port}`);
  });
}

main();
