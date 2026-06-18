import type { Metadata } from 'next';
import { Counter } from '@/components/Counter';
import { MapBackdrop } from '@/components/MapBackdrop';
import { SiteFooter } from '@/components/SiteFooter';
import { getCountsData } from '@/lib/counts';
import { getMapPins } from '@/lib/map';
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

/** Marketing landing + live counter (M5·T0.2). Counter renders server-side. */
export default async function Home() {
  const asOf = todayUtc();
  const [data, pins] = await Promise.all([getCountsData(asOf), getMapPins(asOf)]);
  return (
    <>
      <section className="hero">
        <p className="hero__eyebrow">New Florence Interactive</p>
        <h1 className="hero__title">PeaceClock</h1>
        <p className="hero__lede">
          A transparent, audited count of <strong>confirmed</strong> casualties of the war in Ukraine.
          Every figure is a lower bound and links to its source — never a claim of the full toll.
        </p>
        <p className="hero__cta">
          <a href={`/c/${DEFAULT_THEATER}/${asOf}`}>Open the counter →</a> <a href="/map">Explore the map →</a>{' '}
          <a href="/methodology">How we count →</a>
        </p>
      </section>

      <MapBackdrop pins={pins} />
      <Counter data={data} theater={DEFAULT_THEATER} initialAsOf={asOf} />
      <SiteFooter />
    </>
  );
}
