import { notFound } from 'next/navigation';
import { Counter } from '@/components/Counter';
import { MapBackdrop } from '@/components/MapBackdrop';
import { getCountsData } from '@/lib/counts';
import { getMapPins } from '@/lib/map-pins';
import { isValidDate, todayUtc } from '@/lib/dates';
import { Category, Tier } from '@peaceclock/api-types';
import { isTheaterSlug, theaterEpoch } from '@peaceclock/db';

export const dynamic = 'force-dynamic';

const TIERS = Object.values(Tier);
const CATEGORIES = Object.values(Category);

/**
 * Deep-linkable View 1 (T3.2): /c/:theater/:date?threshold=&category=
 * Refresh restores state — the server reads the same date and the client
 * re-seeds from the URL. Shell hardcodes Ukraine until M8 theater selector.
 */
export default async function DatedCounter({
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

  const threshold = (sp.threshold && TIERS.includes(sp.threshold as Tier)) ? (sp.threshold as Tier) : undefined;
  const category = (sp.category && CATEGORIES.includes(sp.category as Category)) ? (sp.category as Category) : undefined;

  const [data, pins] = await Promise.all([getCountsData(date, theater), getMapPins(date, undefined, theater)]);
  return (
    <>
      <MapBackdrop pins={pins} />
      <Counter
        data={data}
        theater={theater}
        initialAsOf={date}
        initialThreshold={threshold}
        initialCategory={category}
      />
    </>
  );
}