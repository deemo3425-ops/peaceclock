import type { Metadata } from 'next';
import { MapApp } from '@/components/MapApp';
import { todayUtc } from '@/lib/dates';
import { DEFAULT_THEATER } from '@peaceclock/db';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

const TITLE = 'PeaceClock — Confirmed casualties of the war in Ukraine';
const DESCRIPTION =
  'A transparent, audited lower-bound count of confirmed casualties of the war in Ukraine, with every figure linked to its source.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'PeaceClock',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'PeaceClock live confirmed casualty totals',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/api/og'],
  },
};

/** View 2 (map) is the default landing experience. */
export default function Home() {
  return <MapApp theater={DEFAULT_THEATER} initialAsOf={todayUtc()} />;
}