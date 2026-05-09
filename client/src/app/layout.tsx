import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Foody - Food Delivery Tracker',
  description: 'Real-time food delivery tracking application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</body>
    </html>
  );
}
