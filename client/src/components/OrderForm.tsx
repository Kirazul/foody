'use client';
import { useState } from 'react';
import { createOrder, type OrderItem } from '@/lib/api';

interface Props {
  token: string;
  onCreated: () => void;
}

const RESTAURANTS = ['Pizza Palace', 'Burger House', 'Sushi Express', 'Pasta Corner', 'Taco Bell'];
const MENU: Record<string, OrderItem[]> = {
  'Pizza Palace': [{ name: 'Margherita', quantity: 1, price: 12.0 }, { name: 'Pepperoni', quantity: 1, price: 14.5 }, { name: 'Garlic Bread', quantity: 1, price: 5.0 }],
  'Burger House': [{ name: 'Classic Burger', quantity: 1, price: 10.0 }, { name: 'Cheese Burger', quantity: 1, price: 12.0 }, { name: 'Fries', quantity: 1, price: 4.5 }],
  'Sushi Express': [{ name: 'Salmon Roll', quantity: 1, price: 15.0 }, { name: 'Tuna Nigiri', quantity: 1, price: 13.0 }, { name: 'Miso Soup', quantity: 1, price: 4.0 }],
  'Pasta Corner': [{ name: 'Carbonara', quantity: 1, price: 11.0 }, { name: 'Bolognese', quantity: 1, price: 10.5 }, { name: 'Tiramisu', quantity: 1, price: 6.0 }],
  'Taco Bell': [{ name: 'Beef Taco', quantity: 1, price: 8.0 }, { name: 'Burrito', quantity: 1, price: 11.0 }, { name: 'Nachos', quantity: 1, price: 7.0 }],
};

export default function OrderForm({ token, onCreated }: Props) {
  const [restaurant, setRestaurant] = useState(RESTAURANTS[0]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function addItem(item: OrderItem) {
    const existing = items.find((i) => i.name === item.name);
    if (existing) {
      setItems(items.map((i) => i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems([...items, { ...item }]);
    }
  }

  function removeItem(name: string) {
    setItems(items.filter((i) => i.name !== name));
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { setError('Add at least one item'); return; }
    if (!address.trim()) { setError('Enter delivery address'); return; }

    setLoading(true);
    setError('');
    try {
      await createOrder(token, { restaurant, items, delivery_address: address });
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-lg font-semibold">Place a New Order</h2>

      {/* Restaurant Selection */}
      <div>
        <label className="text-sm text-[var(--muted)] mb-2 block">Restaurant</label>
        <div className="flex flex-wrap gap-2">
          {RESTAURANTS.map((r) => (
            <button key={r} type="button" onClick={() => { setRestaurant(r); setItems([]); }}
              className={`px-3 py-1.5 rounded-lg text-sm border cursor-pointer transition-colors ${
                restaurant === r ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--text)]'
              }`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div>
        <label className="text-sm text-[var(--muted)] mb-2 block">Menu</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {MENU[restaurant]?.map((item) => (
            <button key={item.name} type="button" onClick={() => addItem(item)}
              className="p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-left hover:border-[var(--accent)] transition-colors cursor-pointer">
              <div className="text-sm font-medium">{item.name}</div>
              <div className="text-xs text-[var(--accent)]">${item.price.toFixed(2)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      {items.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">Your Cart</h3>
          {items.map((item) => (
            <div key={item.name} className="flex items-center justify-between py-1.5">
              <span className="text-sm">{item.name} x{item.quantity}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--muted)]">${(item.price * item.quantity).toFixed(2)}</span>
                <button type="button" onClick={() => removeItem(item.name)} className="text-[var(--danger)] text-xs hover:underline cursor-pointer">✕</button>
              </div>
            </div>
          ))}
          <div className="border-t border-[var(--border)] mt-2 pt-2 flex justify-between font-medium">
            <span>Total</span>
            <span className="text-[var(--accent)]">${total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Address */}
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address"
        className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]" />

      {error && <p className="text-[var(--danger)] text-sm">{error}</p>}

      <button type="submit" disabled={loading || items.length === 0}
        className="w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 cursor-pointer">
        {loading ? 'Placing order...' : `Place Order — $${total.toFixed(2)}`}
      </button>
    </form>
  );
}
