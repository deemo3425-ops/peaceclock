/**
 * Server-only map-pins fetch (M2·WS4). Converts EPSG:3857 → lon/lat via the
 * shared engine and drops unparseable points. Resilient: empty on error.
 */

import 'server-only';
import type { MapPin } from '@peaceclock/api-types';
import { DEFAULT_THEATER } from '@peaceclock/db';
import { parsePoint3857 } from '@peaceclock/count-engine';
import { queryMapPins } from '@peaceclock/db';

export async function getMapPins(
  asOf: string,
  limit = 150,
  theater = DEFAULT_THEATER,
): Promise<MapPin[]> {
  try {
    const rows = await queryMapPins(asOf, limit, theater);
    const pins: MapPin[] = [];
    for (const r of rows) {
      const ll = parsePoint3857(r.geom3857);
      if (!ll) continue;
      pins.push({
        id: r.evidenceId,
        theater: r.theater,
        lon: ll.lon,
        lat: ll.lat,
        side: r.side,
        tier: r.tier,
        category: r.category,
        date: r.eventDate,
      });
    }
    return pins;
  } catch (error) {
    console.error('[getMapPins] falling back to no pins:', error);
    return [];
  }
}
