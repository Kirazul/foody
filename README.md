# Foody — Real-Time Food Delivery Tracker

A microservices application for ordering food and tracking deliveries in real-time. Built with Node.js for the **SoA et Microservices** course (A.U. 2025-26).

## Architecture

```
┌──────────┐    REST / GraphQL    ┌─────────────┐      gRPC       ┌────────────────┐
│  Client  │ ◄──────────────────► │ API Gateway │ ◄──────────────► │ User Service   │──► SQLite
│ (Next.js)│                      │  (port 4000)│                  │ (port 5001)    │
└──────────┘                      └──────┬──────┘                  └────────────────┘
                                         │
                                         │ gRPC                    ┌────────────────┐
                                         ├────────────────────────►│ Order Service  │──► SQLite
                                         │                         │ (port 5002)    │
                                         │                         └───────┬────────┘
                                         │ gRPC                            │ Kafka
                                         └────────────────────────►┌───────▼────────┐
                                                                   │Delivery Service│──► In-Memory
                                                                   │ (port 5003)    │
                                                                   └────────────────┘
                                    ┌──────────────────────────────────────┐
                                    │          Kafka (port 9092)            │
                                    │  order.created → delivery assigns    │
                                    │  delivery.status.updated → order     │
                                    └──────────────────────────────────────┘
```

## Microservices

| Service | Responsibility | Database | Port |
| --- | --- | --- | --- |
| User Service | Registration, login, JWT, profiles | SQLite | 5001 |
| Order Service | Create/list/cancel orders | SQLite | 5002 |
| Delivery Service | Assign drivers, track location | In-Memory (NoSQL-style) | 5003 |

## Kafka Topics

| Topic | Producer | Consumer | Business Event |
| --- | --- | --- | --- |
| `order.created` | Order Service | Delivery Service | New order placed → assign a driver |
| `delivery.status.updated` | Delivery Service | Order Service | Driver assigned / picked up / delivered → update order status |
| `user.registered` | User Service | (future notifications) | New user signed up |

## REST Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/register` | Create account |
| POST | `/api/login` | Login, get JWT |
| GET | `/api/profile` | Get user profile |
| POST | `/api/orders` | Place a new order |
| GET | `/api/orders` | List my orders |
| GET | `/api/orders/:id` | Get order details |
| PATCH | `/api/orders/:id/cancel` | Cancel a pending order |
| GET | `/api/deliveries/active` | List active deliveries |
| GET | `/api/deliveries/:id` | Get delivery status + location |
| PATCH | `/api/deliveries/:id/location` | Update driver location |

## GraphQL

Endpoint: `POST /graphql`

```graphql
query {
  orders(token: "your-jwt") {
    orders { id restaurant status total }
  }
}

mutation {
  createOrder(token: "jwt", restaurant: "Pizza Palace", items: [{name: "Margherita", quantity: 2, price: 12.5}], delivery_address: "123 Main St") {
    id status total
  }
}
```

## Install & Run

```bash
npm install
npm run dev
```

Gateway: http://localhost:4000
Client: http://localhost:3000

## Run with Docker

```bash
docker compose up --build
```

## Project Structure

```
foody/
├── proto/foody.proto        ← gRPC contract (all 3 services)
├── gateway/src/index.js     ← API Gateway (REST + GraphQL)
├── services/
│   ├── user/src/index.js    ← User Service (SQLite)
│   ├── order/src/index.js   ← Order Service (SQLite)
│   └── delivery/src/index.js← Delivery Service (In-Memory)
├── client/                  ← Next.js frontend
├── docs/                    ← Documentation
├── docker-compose.yml
└── README.md
```

## Team

| Member | Branch | Responsibility |
| --- | --- | --- |
| Mohamed Aziz Mansour | backend | Gateway, proto, infrastructure |
| Mohamed ncib | services | User, Order, Delivery services |
| Rimel Zouari | frontend | Next.js client, documentation |
