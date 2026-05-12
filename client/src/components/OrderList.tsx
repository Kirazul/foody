'use client';
import { useState, useEffect } from 'react';
import { listOrders, cancelOrder, type Order } from '@/lib/api';

interface Props {
  token: string;
  refreshKey: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[var(--warning)]',
  assigned: 'text-blue-400',
  'picked-up': 'text-purple-400',
  'on-the-way': 'text-[var(--accent)]',
  delivered: 'text-[var(--success)]',
  cancelled: 'text-[var(--danger)]',
};

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳',
  assigned: '👨‍🍳',
  'picked-up': '📦',
  'on-the-way': '🚗',
  delivered: '✅',
  cancelled: '❌',
};

export default function OrderList({ token, refreshKey }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, [refreshKey]);

  async function loadOrders() {
    setLoading(true);
    try {
      const data = await listOrders(token);
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(orderId: string) {
    try {
      await cancelOrder(token, orderId);
      loadOrders();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) return <p className="text-[var(--muted)]">Loading orders...</p>;
  if (orders.length === 0) return <p className="text-[var(--muted)]">No orders yet. Place your first order!</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">My Orders ({orders.length})</h2>
      {orders.map((order) => (
        <div key={order.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{order.restaurant}</span>
              <span className={`text-sm ${STATUS_COLORS[order.status] || ''}`}>
                {STATUS_ICONS[order.status] || '•'} {order.status}
              </span>
            </div>
            <span className="text-[var(--accent)] font-medium">${order.total.toFixed(2)}</span>
          </div>
          <div className="text-sm text-[var(--muted)] mb-2">
            {order.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span>📍 {order.delivery_address}</span>
            <span>{new Date(order.created_at).toLocaleString()}</span>
          </div>
          {order.status === 'pending' && (
            <button onClick={() => handleCancel(order.id)}
              className="mt-2 text-xs text-[var(--danger)] hover:underline cursor-pointer">
              Cancel order
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
