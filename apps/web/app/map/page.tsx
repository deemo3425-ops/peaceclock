import { MapApp } from '@/components/MapApp';
import { todayUtc } from '@/lib/dates';
import { DEFAULT_THEATER } from '@peaceclock/db';

export const dynamic = 'force-dynamic';

/** View 2 for today (M4). */
export default function MapPage() {
  return <MapApp theater={DEFAULT_THEATER} initialAsOf={todayUtc()} />;
}
