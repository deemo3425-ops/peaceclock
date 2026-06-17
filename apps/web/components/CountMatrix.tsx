'use client';

import type { MatrixRow } from '@peaceclock/count-engine';
import { WINDOWS } from '@peaceclock/count-engine';
import { Audience, Category, Side, Tier } from '@peaceclock/api-types';
import { SIDE_LABEL, AUDIENCE_LABEL, WINDOW_LABEL, CATEGORY_LABEL } from '@/lib/labels';
import { SourceCell } from './SourceCell';

interface Props {
  rows: MatrixRow[];
  category: Category;
  threshold: Tier;
  asOf: string;
}

/**
 * Count matrix (T3.4): per side × audience × window. Civilian primary,
 * military secondary (labeled lower-coverage). Every figure links to its
 * source(s) via SourceCell (T3.5). The headline number is the 'total' column.
 */
export function CountMatrix({ rows, category, threshold, asOf }: Props) {
  const civilian = rows.filter((r) => r.audience === Audience.CIVILIAN);
  const military = rows.filter((r) => r.audience === Audience.MILITARY);

  return (
    <section className="matrix" aria-label={`${CATEGORY_LABEL[category]} counts`}>
      <Group
        title="Civilian"
        subtitle="primary"
        rows={civilian}
        category={category}
        threshold={threshold}
        asOf={asOf}
      />
      <Group
        title="Military"
        subtitle="secondary · lower coverage"
        rows={military}
        category={category}
        threshold={threshold}
        asOf={asOf}
      />
    </section>
  );
}

function Group({
  title,
  subtitle,
  rows,
  category,
  threshold,
  asOf,
}: {
  title: string;
  subtitle: string;
  rows: MatrixRow[];
  category: Category;
  threshold: Tier;
  asOf: string;
}) {
  return (
    <div className="matrix__group">
      <h2 className="matrix__group-title">
        {title} <span className="matrix__group-sub">{subtitle}</span>
      </h2>
      <table className="matrix__table">
        <caption className="sr-only">
          {title} {CATEGORY_LABEL[category]} by side and time window, as of {asOf}
        </caption>
        <thead>
          <tr>
            <th scope="col">Side</th>
            {WINDOWS.map((w) => (
              <th key={w} scope="col">{WINDOW_LABEL[w]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.side}-${r.audience}`}>
              <th scope="row">{SIDE_LABEL[r.side]}</th>
              {WINDOWS.map((w) => (
                <td key={w} className={w === 'total' ? 'matrix__cell matrix__cell--total' : 'matrix__cell'}>
                  <SourceCell
                    value={r.counts[w]}
                    side={r.side}
                    audience={r.audience}
                    category={category}
                    window={w}
                    threshold={threshold}
                    asOf={asOf}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { Side };
