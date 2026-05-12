import express from 'express';
import cors from 'cors';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { createHandler } from 'graphql-http/lib/use/express';
import { buildSchema } from 'graphql';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.GATEWAY_PORT || 4000;
const PROTO_PATH = path.join(__dirname, '../..', 'proto/foody.proto');
const SCHEMA_PATH = path.join(__dirname, '..', 'schema.graphql');

// --- Load Proto & Create gRPC Clients ---
const packageDef = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true });
const proto = grpc.loadPackageDefinition(packageDef).foody;

const userClient = new proto.UserService(process.env.USER_SERVICE_URL || 'localhost:5001', grpc.credentials.createInsecure());
const orderClient = new proto.OrderService(process.env.ORDER_SERVICE_URL || 'localhost:5002', grpc.credentials.createInsecure());
const deliveryClient = new proto.DeliveryService(process.env.DELIVERY_SERVICE_URL || 'localhost:5003', grpc.credentials.createInsecure());

// Helper: promisify gRPC calls
function grpcCall(client, method, request) {
  return new Promise((resolve, reject) => {
    client[method](request, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

// --- Express App ---
const app = express();
app.use(cors());
app.use(express.json());

// --- REST ENDPOINTS ---

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// Auth
app.post('/api/register', async (req, res) => {
  try {
    const result = await grpcCall(userClient, 'Register', req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const result = await grpcCall(userClient, 'Login', req.body);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const result = await grpcCall(userClient, 'GetProfile', { token });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Orders
app.post('/api/orders', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const result = await grpcCall(orderClient, 'CreateOrder', { ...req.body, token });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const result = await grpcCall(orderClient, 'ListOrders', { token });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const result = await grpcCall(orderClient, 'GetOrder', { token, order_id: req.params.id });
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/cancel', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const result = await grpcCall(orderClient, 'CancelOrder', { token, order_id: req.params.id });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delivery
app.get('/api/deliveries/active', async (req, res) => {
  try {
    const result = await grpcCall(deliveryClient, 'ListActiveDeliveries', {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deliveries/:id', async (req, res) => {
  try {
    const result = await grpcCall(deliveryClient, 'GetDelivery', { delivery_id: req.params.id });
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.patch('/api/deliveries/:id/location', async (req, res) => {
  try {
    const result = await grpcCall(deliveryClient, 'UpdateLocation', { delivery_id: req.params.id, ...req.body });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- GRAPHQL ---
const schema = buildSchema(readFileSync(SCHEMA_PATH, 'utf-8'));

const root = {
  // Queries
  profile: ({ token }) => grpcCall(userClient, 'GetProfile', { token }),
  orders: ({ token }) => grpcCall(orderClient, 'ListOrders', { token }),
  order: ({ token, order_id }) => grpcCall(orderClient, 'GetOrder', { token, order_id }),
  activeDeliveries: () => grpcCall(deliveryClient, 'ListActiveDeliveries', {}),
  delivery: ({ delivery_id }) => grpcCall(deliveryClient, 'GetDelivery', { delivery_id }),

  // Mutations
  register: (args) => grpcCall(userClient, 'Register', args),
  login: (args) => grpcCall(userClient, 'Login', args),
  createOrder: (args) => grpcCall(orderClient, 'CreateOrder', args),
  cancelOrder: (args) => grpcCall(orderClient, 'CancelOrder', args),
};

app.all('/graphql', createHandler({ schema, rootValue: root }));

// --- Start ---
app.listen(PORT, () => {
  console.log(`[gateway] REST API: http://localhost:${PORT}/api`);
  console.log(`[gateway] GraphQL:  http://localhost:${PORT}/graphql`);
  console.log(`[gateway] Health:   http://localhost:${PORT}/health`);
});
