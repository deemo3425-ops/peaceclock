import { notFound } from 'next/navigation';
import { MapApp } from '@/components/MapApp';
import { isValidDate, todayUtc } from '@/lib/dates';
import { Category, Tier } from '@peaceclock/api-types';
import { DEFAULT_THEATER, isTheaterSlug, theaterEpoch } from '@peaceclock/db';

export const dynamic = 'force-dynamic';

const TIERS = Object.values(Tier);
const CATEGORIES = Object.values(Category);

/** Deep-linkable View 2 (M4·T2.1): /m/:theater/:date?threshold=&category= */
export default async function DatedMap({
  params,
  searchParams,
}: {
  params: Promise<{ theater: string; date: string }>;
  searchParams: Promise<{ threshold?: string; category?: string }>;
}) {
  const { theater: theaterRaw, date } = await params;
  const sp = await searchParams;

  if (!isTheaterSlug(theaterRaw)) notFound();
  const theater = theaterRaw;
  const epoch = theaterEpoch(theater);

  if (!isValidDate(date) || date < epoch || date > todayUtc()) notFound();

  const threshold = sp.threshold && TIERS.includes(sp.threshold as Tier) ? (sp.threshold as Tier) : undefined;
  const category = sp.category && CATEGORIES.includes(sp.category as Category) ? (sp.category as Category) : undefined;

  return (
    <MapApp
      theater={theater}
      initialAsOf={date}
      initialThreshold={threshold}
      initialCategory={category}
    />
  );
}