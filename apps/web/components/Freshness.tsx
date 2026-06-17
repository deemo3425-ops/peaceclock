import type { CountsResponse } from '@peaceclock/api-types';
import { Side } from '@peaceclock/api-types';
import { SIDE_LABEL } from '@/lib/labels';

interface Props {
  asOf: string;
  lastUpdated: string;
  lastUpdatedBySide: CountsResponse['lastUpdatedBySide'];
}

function fmt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t) || t === 0) return 'no data yet';
  return new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/** "As of" + last-updated freshness (T3.5 / T1.4). Counts are a lower bound. */
export function Freshness({ asOf, lastUpdated, lastUpdatedBySide }: Props) {
  return (
    <footer className="freshness">
      <p>
        Showing counts <strong>as of {asOf}</strong>. Figures are a lower bound — they rise only as
        evidence is confirmed.
      </p>
      <p className="freshness__updated">
        Last updated: {fmt(lastUpdated)}
        {([Side.UA_COALITION, Side.RUSSIA] as const).map((s) =>
          lastUpdatedBySide[s] ? (
            <span key={s}> · {SIDE_LABEL[s]}: {fmt(lastUpdatedBySide[s]!)}</span>
          ) : null,
        )}
      </p>
    </footer>
  );
}
