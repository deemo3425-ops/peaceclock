import type { Metadata } from 'next';
import './globals.css';
import { validateEnv } from '@/lib/env';
import { initOtel } from '@/lib/otel';

// T0.4–T0.5: Validate environment and init OTel at app boot
if (typeof window === 'undefined') {
  validateEnv();
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
