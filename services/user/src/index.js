import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Kafka } from 'kafkajs';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.USER_SERVICE_PORT || 5001;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const PROTO_PATH = path.join(__dirname, '../../..', 'proto/foody.proto');

// --- Database Setup ---
mkdirSync(path.join(__dirname, '../.data'), { recursive: true });
const db = new DatabaseSync(path.join(__dirname, '../.data/users.sqlite'));
db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    created_at TEXT NOT NULL
  )
`);

// --- Kafka Producer ---
const kafka = new Kafka({ clientId: 'user-service', brokers: [KAFKA_BROKER] });
let producer;
async function connectKafka() {
  try {
    producer = kafka.producer();
    await producer.connect();
    console.log('[user-service] Kafka producer connected');
  } catch (err) {
    console.warn('[user-service] Kafka unavailable, continuing without events');
    producer = null;
  }
}

async function publishEvent(topic, data) {
  if (!producer) return;
  try {
    await producer.send({
      topic,
      messages: [{ key: data.id || randomUUID(), value: JSON.stringify(data) }]
    });
  } catch (err) {
    console.warn('[user-service] Failed to publish event:', err.message);
  }
}

// --- Helper Functions ---
function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function toProfile(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    address: row.address || '',
    created_at: row.created_at
  };
}

// --- gRPC Service Implementation ---
const userService = {
  Register: async (call, callback) => {
    try {
      const { name, email, password, phone, address } = call.request;

      if (!name || !email || !password) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Name, email and password are required' });
      }

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return callback({ code: grpc.status.ALREADY_EXISTS, message: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: randomUUID(),
        name,
        email,
        password: hashedPassword,
        phone: phone || '',
        address: address || '',
        created_at: new Date().toISOString()
      };

      db.prepare('INSERT INTO users (id, name, email, password, phone, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(user.id, user.name, user.email, user.password, user.phone, user.address, user.created_at);

      const token = createToken(user);

      // Publish event to Kafka
      await publishEvent('user.registered', { id: user.id, name: user.name, email: user.email, timestamp: user.created_at });

      callback(null, { token, user: toProfile(user) });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  Login: async (call, callback) => {
    try {
      const { email, password } = call.request;

      if (!email || !password) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Email and password are required' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        return callback({ code: grpc.status.NOT_FOUND, message: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Invalid email or password' });
      }

      const token = createToken(user);
      callback(null, { token, user: toProfile(user) });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  GetProfile: (call, callback) => {
    const decoded = verifyToken(call.request.token);
    if (!decoded) {
      return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Invalid token' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'User not found' });
    }

    callback(null, toProfile(user));
  }
};

// --- Start gRPC Server ---
async function main() {
  await connectKafka();

  const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true
  });
  const proto = grpc.loadPackageDefinition(packageDef).foody;

  const server = new grpc.Server();
  server.addService(proto.UserService.service, userService);

  server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) { console.error(err); process.exit(1); }
    console.log(`[user-service] gRPC server running on port ${port}`);
  });
}

main();
