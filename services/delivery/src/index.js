import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { Kafka } from 'kafkajs';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.DELIVERY_SERVICE_PORT || 5003;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const PROTO_PATH = path.join(__dirname, '../../..', 'proto/foody.proto');

// --- In-Memory Store (simulates NoSQL/RxDB) ---
const deliveries = new Map();
const drivers = ['Ali Ben Salah', 'Sami Trabelsi', 'Youssef Hamdi', 'Nour Mansouri', 'Amine Jaziri'];
function pickRandomDriver() { return drivers[Math.floor(Math.random() * drivers.length)]; }

// --- Kafka ---
const kafka = new Kafka({ clientId: 'delivery-service', brokers: [KAFKA_BROKER] });
let producer;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function connectKafka() {
  // Connect producer
  try {
    producer = kafka.producer({ allowAutoTopicCreation: true });
    await producer.connect();
    console.log('[delivery-service] Kafka producer connected');
  } catch (err) {
    console.warn('[delivery-service] Kafka producer failed:', err.message);
    producer = null;
    return;
  }

  // Connect consumer with retry (topics may not exist yet)
  connectConsumer();
}

async function connectConsumer() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const consumer = kafka.consumer({ groupId: 'delivery-service-group', allowAutoTopicCreation: true });
      await consumer.connect();
      await consumer.subscribe({ topic: 'order.created', fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ message }) => {
          const order = JSON.parse(message.value.toString());
          const delivery = {
            id: randomUUID(),
            order_id: order.id,
            driver_name: pickRandomDriver(),
            status: 'assigned',
            latitude: 36.8065,
            longitude: 10.1815,
            pickup_address: order.restaurant || 'Restaurant',
            delivery_address: order.delivery_address,
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          deliveries.set(delivery.id, delivery);
          await publishEvent('delivery.status.updated', {
            order_id: order.id,
            delivery_id: delivery.id,
            driver_name: delivery.driver_name,
            status: 'assigned',
            timestamp: delivery.assigned_at
          });
          console.log(`[delivery-service] Driver "${delivery.driver_name}" assigned to order ${order.id}`);

          // Simulate delivery progress automatically
          simulateDelivery(delivery);
        }
      });
      console.log('[delivery-service] Kafka consumer connected');
      return;
    } catch (err) {
      console.log(`[delivery-service] Consumer attempt ${attempt}/30 failed: ${err.message}`);
      await sleep(3000);
    }
  }
  console.warn('[delivery-service] Consumer gave up after 30 attempts');
}

async function publishEvent(topic, data) {
  if (!producer) return;
  try {
    await producer.send({ topic, messages: [{ key: data.order_id || randomUUID(), value: JSON.stringify(data) }] });
  } catch (err) {
    console.warn('[delivery-service] Publish failed:', err.message);
  }
}

// Simulate a real delivery: assigned → picked-up → on-the-way → delivered
async function simulateDelivery(delivery) {
  const steps = [
    { status: 'picked-up', delay: 8000, lat: 36.8085, lng: 10.1750 },   // 8s: driver picks up food
    { status: 'on-the-way', delay: 12000, lat: 36.8120, lng: 10.1680 }, // 12s: driver is driving
    { status: 'delivered', delay: 15000, lat: 36.8150, lng: 10.1620 }   // 15s: driver arrives
  ];

  for (const step of steps) {
    await sleep(step.delay);
    delivery.status = step.status;
    delivery.latitude = step.lat;
    delivery.longitude = step.lng;
    delivery.updated_at = new Date().toISOString();

    await publishEvent('delivery.status.updated', {
      order_id: delivery.order_id,
      delivery_id: delivery.id,
      driver_name: delivery.driver_name,
      status: step.status,
      timestamp: delivery.updated_at
    });
    console.log(`[delivery-service] Order ${delivery.order_id} → ${step.status}`);
  }

  // Remove from active deliveries after delivered
  setTimeout(() => deliveries.delete(delivery.id), 5000);
}

// --- gRPC ---
const deliveryService = {
  AssignDriver: async (call, callback) => {
    const { order_id, pickup_address, delivery_address } = call.request;
    if (!order_id) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'order_id required' });
    const delivery = {
      id: randomUUID(), order_id, driver_name: pickRandomDriver(), status: 'assigned',
      latitude: 36.8065, longitude: 10.1815, pickup_address: pickup_address || '', delivery_address: delivery_address || '',
      assigned_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    deliveries.set(delivery.id, delivery);
    await publishEvent('delivery.status.updated', { order_id, delivery_id: delivery.id, driver_name: delivery.driver_name, status: 'assigned', timestamp: delivery.assigned_at });
    callback(null, delivery);
  },
  UpdateLocation: async (call, callback) => {
    const { delivery_id, latitude, longitude, status } = call.request;
    const delivery = deliveries.get(delivery_id);
    if (!delivery) return callback({ code: grpc.status.NOT_FOUND, message: 'Delivery not found' });
    delivery.latitude = latitude; delivery.longitude = longitude;
    if (status) delivery.status = status;
    delivery.updated_at = new Date().toISOString();
    if (status) await publishEvent('delivery.status.updated', { order_id: delivery.order_id, delivery_id: delivery.id, driver_name: delivery.driver_name, status, timestamp: delivery.updated_at });
    callback(null, delivery);
  },
  GetDelivery: (call, callback) => {
    const delivery = deliveries.get(call.request.delivery_id);
    if (!delivery) return callback({ code: grpc.status.NOT_FOUND, message: 'Delivery not found' });
    callback(null, delivery);
  },
  ListActiveDeliveries: (call, callback) => {
    const active = [...deliveries.values()].filter(d => d.status !== 'delivered' && d.status !== 'cancelled');
    callback(null, { deliveries: active });
  }
};

// --- Start ---
async function main() {
  await connectKafka();
  const packageDef = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true });
  const proto = grpc.loadPackageDefinition(packageDef).foody;
  const server = new grpc.Server();
  server.addService(proto.DeliveryService.service, deliveryService);
  server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) { console.error(err); process.exit(1); }
    console.log(`[delivery-service] gRPC server running on port ${port}`);
  });
}

main();
