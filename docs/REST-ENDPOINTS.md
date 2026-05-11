# REST API Endpoints

Base URL: `http://localhost:4000`

## Authentication

| Method | Endpoint | Body | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/api/register` | `{ name, email, password, phone?, address? }` | `{ token, user }` | No |
| POST | `/api/login` | `{ email, password }` | `{ token, user }` | No |
| GET | `/api/profile` | — | `{ id, name, email, phone, address }` | Bearer token |

## Orders

| Method | Endpoint | Body | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/api/orders` | `{ restaurant, items: [{name, quantity, price}], delivery_address }` | Order object | Bearer token |
| GET | `/api/orders` | — | `{ orders: [...] }` | Bearer token |
| GET | `/api/orders/:id` | — | Order object | Bearer token |
| PATCH | `/api/orders/:id/cancel` | — | Order object (status: cancelled) | Bearer token |

## Deliveries

| Method | Endpoint | Body | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/api/deliveries/active` | — | `{ deliveries: [...] }` | No |
| GET | `/api/deliveries/:id` | — | Delivery object | No |
| PATCH | `/api/deliveries/:id/location` | `{ latitude, longitude, status? }` | Delivery object | No |

## Order Statuses

`pending` → `assigned` → `picked-up` → `on-the-way` → `delivered`

Or: `pending` → `cancelled`

## Error Format

```json
{ "error": "Error message here" }
```
