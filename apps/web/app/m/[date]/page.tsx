import { notFound } from 'next/navigation';
import { MapApp } from '@/components/MapApp';
import { isValidDate, todayUtc } from '@/lib/dates';
import { Category, Tier } from '@peaceclock/api-types';

export const dynamic = 'force-dynamic';

const TIERS = Object.values(Tier);
const CATEGORIES = Object.values(Category);

/** Deep-linkable View 2 (M4·T2.1): /m/:date?threshold=&category= */
export default async function DatedMap({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ threshold?: string; category?: string }>;
}) {
  const { date } = await params;
  const sp = await searchParams;
  if (!isValidDate(date) || date < '2022-02-24' || date > todayUtc()) notFound();

  const threshold = sp.threshold && TIERS.includes(sp.threshold as Tier) ? (sp.threshold as Tier) : undefined;
  const category = sp.category && CATEGORIES.includes(sp.category as Category) ? (sp.category as Category) : undefined;

  return <MapApp initialAsOf={date} initialThreshold={threshold} initialCategory={category} />;
}
