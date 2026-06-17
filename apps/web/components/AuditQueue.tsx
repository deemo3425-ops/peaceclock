'use client';

import { useState } from 'react';
import type { AuditQueueItem } from '@peaceclock/db';
import { Tier } from '@peaceclock/api-types';
import { SIDE_LABEL, AUDIENCE_LABEL, CATEGORY_LABEL } from '@/lib/labels';

/** Human-audit queue UI (M3·WS7·T7.1/T7.2). Promote / demote / reject. */
export function AuditQueue({ initial }: { initial: AuditQueueItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(casualtyId: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(casualtyId);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ casualtyId, action, ...extra }),
      });
      if (res.ok) setItems((xs) => xs.filter((x) => x.casualtyId !== casualtyId));
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) return <p className="freshness">Audit queue is empty.</p>;

  return (
    <table className="matrix__table">
      <caption className="sr-only">AI-corroborated casualties awaiting human audit</caption>
      <thead>
        <tr>
          <th scope="col">Side</th>
          <th scope="col">Category</th>
          <th scope="col">Date</th>
          <th scope="col">Count</th>
          <th scope="col">Score</th>
          <th scope="col">Corrob.</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.casualtyId}>
            <th scope="row">{SIDE_LABEL[it.side]} · {AUDIENCE_LABEL[it.audience]}</th>
            <td>{CATEGORY_LABEL[it.category]}</td>
            <td>{it.eventDate}</td>
            <td>{it.count}</td>
            <td>{it.matchScore?.toFixed(2) ?? '—'}</td>
            <td>{it.corroborators}</td>
            <td>
              <button className="toggle" disabled={busy === it.casualtyId} onClick={() => act(it.casualtyId, 'promote', { tier: Tier.CONFIRMED })}>Promote→Confirmed</button>{' '}
              <button className="toggle" disabled={busy === it.casualtyId} onClick={() => act(it.casualtyId, 'demote', { tier: Tier.OSINT })}>Demote→OSINT</button>{' '}
              <button className="toggle" disabled={busy === it.casualtyId} onClick={() => act(it.casualtyId, 'reject')}>Reject</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
