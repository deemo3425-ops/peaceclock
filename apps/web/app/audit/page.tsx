import { AuditQueue } from '@/components/AuditQueue';
import { getAuditQueue } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** Human-audit queue page (M3·WS7). Gated by AUDIT_SECRET at the API layer. */
export default async function AuditPage() {
  const items = await getAuditQueue();
  return (
    <main className="counter">
      <header className="counter__head">
        <h1>Audit queue</h1>
        <p className="counter__sub">AI-corroborated casualties awaiting human review (PRD §6.4).</p>
      </header>
      <AuditQueue initial={items} />
    </main>
  );
}
