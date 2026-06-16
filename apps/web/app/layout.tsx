import type { Metadata } from 'next';
import { validateEnv } from '@/lib/env';

// T0.4: Validate environment at app boot
if (typeof window === 'undefined') {
  validateEnv();
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
