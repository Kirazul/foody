# GraphQL Schema

Endpoint: `POST http://localhost:4000/graphql`

## Queries

```graphql
# Get user profile
query {
  profile(token: "jwt-token") {
    id name email phone address
  }
}

# List user's orders
query {
  orders(token: "jwt-token") {
    orders { id restaurant status total delivery_address created_at }
  }
}

# Get specific order
query {
  order(token: "jwt-token", order_id: "uuid") {
    id restaurant items { name quantity price } status total
  }
}

# List active deliveries (real-time tracking)
query {
  activeDeliveries {
    deliveries { id order_id driver_name status latitude longitude }
  }
}

# Get specific delivery
query {
  delivery(delivery_id: "uuid") {
    id order_id driver_name status latitude longitude pickup_address delivery_address
  }
}
```

## Mutations

```graphql
# Register
mutation {
  register(name: "Ali", email: "ali@test.com", password: "123456") {
    token
    user { id name email }
  }
}

# Login
mutation {
  login(email: "ali@test.com", password: "123456") {
    token
    user { id name }
  }
}

# Create order
mutation {
  createOrder(
    token: "jwt-token",
    restaurant: "Pizza Palace",
    items: [{ name: "Margherita", quantity: 2, price: 12.0 }],
    delivery_address: "123 Main St"
  ) {
    id status total
  }
}

# Cancel order
mutation {
  cancelOrder(token: "jwt-token", order_id: "uuid") {
    id status
  }
}
```

## Why GraphQL?

GraphQL lets the client request exactly the fields it needs. For example:
- The order list page only needs `id, restaurant, status, total` — not the full items array
- The delivery tracker only needs `driver_name, status, latitude, longitude` — not addresses

With REST, you always get all fields. With GraphQL, you choose.
