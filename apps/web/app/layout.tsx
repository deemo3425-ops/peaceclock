import type { Metadata } from 'next';

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
