'use client';
import { useState } from 'react';
import { register, login, type User } from '@/lib/api';

interface Props {
  onAuth: (data: { token: string; user: User }) => void;
}

export default function AuthForm({ onAuth }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;

    try {
      if (isLogin) {
        const data = await login({ email, password });
        onAuth(data);
      } else {
        const name = form.get('name') as string;
        const phone = form.get('phone') as string;
        const address = form.get('address') as string;
        const data = await register({ name, email, password, phone, address });
        onAuth(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <span className="text-5xl">🍕</span>
        <h1 className="text-3xl font-bold mt-4">Foody</h1>
        <p className="text-[var(--muted)] mt-2">Real-time food delivery tracker</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">{isLogin ? 'Login' : 'Create Account'}</h2>

        {!isLogin && (
          <>
            <input name="name" placeholder="Full name" required
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]" />
            <input name="phone" placeholder="Phone (optional)"
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]" />
            <input name="address" placeholder="Address (optional)"
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]" />
          </>
        )}

        <input name="email" type="email" placeholder="Email" required
          className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]" />
        <input name="password" type="password" placeholder="Password" required minLength={6}
          className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]" />

        {error && <p className="text-[var(--danger)] text-sm">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 cursor-pointer">
          {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
        </button>

        <p className="text-center text-sm text-[var(--muted)]">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-[var(--accent)] hover:underline cursor-pointer">
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </form>
    </div>
  );
}
