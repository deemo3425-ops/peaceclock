import { notFound } from 'next/navigation';
import { Counter } from '@/components/Counter';
import { MapBackdrop } from '@/components/MapBackdrop';
import { getCountsData } from '@/lib/counts';
import { getMapPins } from '@/lib/map';
import { isValidDate, todayUtc } from '@/lib/dates';
import { Category, Tier } from '@peaceclock/api-types';

export const dynamic = 'force-dynamic';

const TIERS = Object.values(Tier);
const CATEGORIES = Object.values(Category);

/**
 * Deep-linkable View 1 (T3.2): /c/:date?threshold=&category=
 * Refresh restores state — the server reads the same date and the client
 * re-seeds from the URL.
 */
export default async function DatedCounter({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ threshold?: string; category?: string }>;
}) {
  const { date } = await params;
  const sp = await searchParams;

  if (!isValidDate(date) || date < '2022-02-24' || date > todayUtc()) notFound();

  const threshold = (sp.threshold && TIERS.includes(sp.threshold as Tier)) ? (sp.threshold as Tier) : undefined;
  const category = (sp.category && CATEGORIES.includes(sp.category as Category)) ? (sp.category as Category) : undefined;

  const [data, pins] = await Promise.all([getCountsData(date), getMapPins(date)]);
  return (
    <>
      <MapBackdrop pins={pins} />
      <Counter data={data} initialAsOf={date} initialThreshold={threshold} initialCategory={category} />
    </>
  );
}
