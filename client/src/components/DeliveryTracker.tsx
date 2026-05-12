'use client';
import { useState, useEffect } from 'react';
import { getActiveDeliveries, type Delivery } from '@/lib/api';

const STATUS_STEPS = ['assigned', 'picked-up', 'on-the-way', 'delivered'];

function ProgressBar({ status }: { status: string }) {
  const currentStep = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-2">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-1 flex-1">
          <div className={`h-1.5 flex-1 rounded-full ${i <= currentStep ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
        </div>
      ))}
    </div>
  );
}

export default function DeliveryTracker() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeliveries();
    const interval = setInterval(loadDeliveries, 5000); // Poll every 5s for real-time feel
    return () => clearInterval(interval);
  }, []);

  async function loadDeliveries() {
    try {
      const data = await getActiveDeliveries();
      setDeliveries(data.deliveries || []);
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p className="text-[var(--muted)]">Loading deliveries...</p>;
  if (deliveries.length === 0) return <p className="text-[var(--muted)]">No active deliveries right now.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Live Deliveries ({deliveries.length})</h2>
        <span className="text-xs text-[var(--muted)]">Auto-refreshes every 5s</span>
      </div>
      {deliveries.map((d) => (
        <div key={d.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm">🚗 {d.driver_name}</span>
            <span className="text-xs text-[var(--accent)]">{d.status}</span>
          </div>
          <div className="text-xs text-[var(--muted)] space-y-0.5">
            <p>📍 From: {d.pickup_address}</p>
            <p>🏠 To: {d.delivery_address}</p>
            <p>📌 Location: {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}</p>
          </div>
          <ProgressBar status={d.status} />
          <div className="text-xs text-[var(--muted)] mt-2">
            Order: {d.order_id.slice(0, 8)}... • Updated: {new Date(d.updated_at).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
}
