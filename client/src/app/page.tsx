'use client';
import { useState, useEffect } from 'react';
import AuthForm from '@/components/AuthForm';
import OrderForm from '@/components/OrderForm';
import OrderList from '@/components/OrderList';
import DeliveryTracker from '@/components/DeliveryTracker';
import type { User } from '@/lib/api';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<'orders' | 'new-order' | 'tracking'>('orders');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('foody_token');
    const savedUser = localStorage.getItem('foody_user');
    if (saved) setToken(saved);
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  function handleAuth(data: { token: string; user: User }) {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('foody_token', data.token);
    localStorage.setItem('foody_user', JSON.stringify(data.user));
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('foody_token');
    localStorage.removeItem('foody_user');
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AuthForm onAuth={handleAuth} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍕</span>
          <h1 className="text-xl font-bold">Foody</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[var(--muted)] text-sm">Hello, {user?.name}</span>
          <button onClick={handleLogout} className="text-sm text-[var(--danger)] hover:underline cursor-pointer">
            Logout
          </button>
        </div>
      </header>

      <nav className="border-b border-[var(--border)] px-6 flex gap-1">
        {(['orders', 'new-order', 'tracking'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {t === 'orders' ? '📋 My Orders' : t === 'new-order' ? '➕ New Order' : '🚗 Live Tracking'}
          </button>
        ))}
      </nav>

      <main className="p-6 max-w-4xl mx-auto">
        {tab === 'orders' && <OrderList token={token} refreshKey={refreshKey} />}
        {tab === 'new-order' && (
          <OrderForm token={token} onCreated={() => { setTab('orders'); setRefreshKey((k) => k + 1); }} />
        )}
        {tab === 'tracking' && <DeliveryTracker />}
      </main>
    </div>
  );
}
