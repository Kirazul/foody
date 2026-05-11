# Databases

## User Service — SQLite3

File: `services/user/.data/users.sqlite`

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,        -- bcrypt hash
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
```

## Order Service — SQLite3

File: `services/order/.data/orders.sqlite`

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  restaurant TEXT NOT NULL,
  items TEXT NOT NULL,            -- JSON array of {name, quantity, price}
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_address TEXT NOT NULL,
  driver_id TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Delivery Service — In-Memory (NoSQL-style)

No file on disk. Data lives in a JavaScript `Map` object. Each delivery is a document:

```json
{
  "id": "uuid",
  "order_id": "uuid",
  "driver_name": "Ali Ben Salah",
  "status": "on-the-way",
  "latitude": 36.8065,
  "longitude": 10.1815,
  "pickup_address": "Pizza Palace",
  "delivery_address": "123 Main St",
  "assigned_at": "2026-05-12T10:00:00Z",
  "updated_at": "2026-05-12T10:05:00Z"
}
```

This simulates a NoSQL document store (like RxDB). Data is lost when the service restarts, which is fine for real-time delivery tracking — deliveries are short-lived.

## Database Isolation

Each service owns its own data:
- User Service NEVER reads the orders database
- Order Service NEVER reads the users database
- Delivery Service has no persistent database at all

Services communicate through Kafka events, not shared databases.
