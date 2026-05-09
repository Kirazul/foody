const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  user_id: string;
  restaurant: string;
  items: OrderItem[];
  total: number;
  status: string;
  delivery_address: string;
  driver_id: string;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  driver_name: string;
  status: string;
  latitude: number;
  longitude: number;
  pickup_address: string;
  delivery_address: string;
  assigned_at: string;
  updated_at: string;
}

async function request(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function register(body: { name: string; email: string; password: string; phone?: string; address?: string }) {
  return request('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export function login(body: { email: string; password: string }) {
  return request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export function getProfile(token: string) {
  return request('/api/profile', { headers: { Authorization: `Bearer ${token}` } });
}

export function createOrder(token: string, body: { restaurant: string; items: OrderItem[]; delivery_address: string }) {
  return request('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
}

export function listOrders(token: string): Promise<{ orders: Order[] }> {
  return request('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
}

export function cancelOrder(token: string, orderId: string) {
  return request(`/api/orders/${orderId}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
}

export function getActiveDeliveries(): Promise<{ deliveries: Delivery[] }> {
  return request('/api/deliveries/active');
}

export function getDelivery(id: string): Promise<Delivery> {
  return request(`/api/deliveries/${id}`);
}
