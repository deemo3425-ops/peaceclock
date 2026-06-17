import { MapApp } from '@/components/MapApp';
import { todayUtc } from '@/lib/dates';

export const dynamic = 'force-dynamic';

/** View 2 for today (M4). */
export default function MapPage() {
  return <MapApp initialAsOf={todayUtc()} />;
}
