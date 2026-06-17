import type { MapPin } from '@peaceclock/api-types';
import { Side } from '@peaceclock/api-types';
import { TIER_LABEL, SIDE_LABEL, CATEGORY_LABEL } from '@/lib/labels';

interface Props {
  pins: MapPin[];
}

/** Side + tier → sprite class (matches MapLibre atlas naming, PRD §5.3). */
function pinSpriteClass(side: Side, tier: MapPin['tier']): string {
  const sideKey = side === Side.RUSSIA ? 'russia' : 'ua';
  return `pin pin--sprite pin--${tier} pin--${sideKey}`;
}

/**
 * Lightweight, non-interactive world backdrop (M2·WS4·T4.1).
 * Equirectangular placement of a capped set of recent geolocated evidence;
 * each pin carries an authentication badge and links to /api/evidence/:id.
 *
 * M2↔M4 boundary: NO clustering, NO pan/zoom, NO tile layer here. The full
 * interactive ST_ClusterDBSCAN map is M4 (EDD §9.3). Keep this cheap.
 * Pin glyphs reuse the §5.3 sprite sheet at reduced opacity.
 */
export function MapBackdrop({ pins }: Props) {
  return (
    <section className="backdrop" aria-label="Recent geolocated evidence">
      <div className="backdrop__frame" role="img" aria-label={`${pins.length} recent geolocated reports on a world map`}>
        {/* equirectangular graticule, purely decorative */}
        <div className="backdrop__grid" aria-hidden="true" />
        <div className="backdrop__vignette" aria-hidden="true" />
        {pins.map((p) => {
          const left = ((p.lon + 180) / 360) * 100;
          const top = ((90 - p.lat) / 180) * 100;
          return (
            <a
              key={p.id}
              className={pinSpriteClass(p.side, p.tier)}
              style={{ left: `${left}%`, top: `${top}%` }}
              href={`/api/evidence/${p.id}`}
              target="_blank"
              rel="noreferrer noopener"
              title={`${SIDE_LABEL[p.side]} · ${CATEGORY_LABEL[p.category]} · ${TIER_LABEL[p.tier]} · ${p.date}`}
            >
              <span className="sr-only">
                {SIDE_LABEL[p.side]} {CATEGORY_LABEL[p.category]}, {TIER_LABEL[p.tier]}, {p.date}
              </span>
            </a>
          );
        })}
      </div>
      {pins.length === 0 && <p className="backdrop__empty">No geolocated evidence to display yet.</p>}
    </section>
  );
}