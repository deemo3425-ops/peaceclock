import type { Metadata } from 'next';
import './globals.css';
import { initOtel } from '@/lib/otel';

// T0.5: Init OTel at app boot (env validation runs in API routes / data loaders only)
if (typeof window === 'undefined') {
  initOtel();
}

export const metadata: Metadata = {
  title: 'PeaceClock',
  description: 'Confirmed casualty tracker for the war in Ukraine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}