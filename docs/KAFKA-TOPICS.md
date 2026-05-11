# Kafka Topics

## Topics

| Topic | Producer | Consumer | Business Event |
| --- | --- | --- | --- |
| `order.created` | Order Service | Delivery Service | A user placed a new order. Delivery Service assigns a driver. |
| `delivery.status.updated` | Delivery Service | Order Service | Driver status changed (assigned, picked-up, on-the-way, delivered). Order Service updates the order status. |
| `user.registered` | User Service | — (future: notification service) | A new user signed up. |

## Message Formats

### order.created
```json
{
  "id": "order-uuid",
  "user_id": "user-uuid",
  "restaurant": "Pizza Palace",
  "delivery_address": "123 Main St",
  "total": 29.0,
  "timestamp": "2026-05-12T10:00:00Z"
}
```

### delivery.status.updated
```json
{
  "order_id": "order-uuid",
  "delivery_id": "delivery-uuid",
  "driver_name": "Ali Ben Salah",
  "status": "on-the-way",
  "timestamp": "2026-05-12T10:05:00Z"
}
```

### user.registered
```json
{
  "id": "user-uuid",
  "name": "Mohamed",
  "email": "user@example.com",
  "timestamp": "2026-05-12T09:00:00Z"
}
```

## Flow

```
1. User places order → Order Service saves to SQLite
2. Order Service publishes "order.created" to Kafka
3. Delivery Service consumes "order.created" → assigns a random driver
4. Delivery Service publishes "delivery.status.updated" (status: assigned)
5. Order Service consumes "delivery.status.updated" → updates order status to "assigned"
6. Driver picks up food → Delivery Service publishes status: "picked-up"
7. Driver on the way → Delivery Service publishes status: "on-the-way"
8. Driver arrives → Delivery Service publishes status: "delivered"
9. Order Service updates final status to "delivered"
```

Kafka decouples Order Service from Delivery Service. Neither service calls the other directly. They only communicate through events.
