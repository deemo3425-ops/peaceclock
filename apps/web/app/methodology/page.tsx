import type { Metadata } from 'next';
import {
  CONTRADICTION_CLEAR_MARGIN,
  DEFAULT_HEADLINE_THRESHOLD,
  MATCH_WEIGHTS,
  TIER_RANK,
  TIER_THRESHOLDS,
  SCORE_FLOOR,
} from '@peaceclock/db';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Methodology — PeaceClock',
  description: 'How PeaceClock authenticates, tiers, and counts casualty evidence.',
};

const TIER_DEFS: Record<keyof typeof TIER_RANK, { name: string; def: string }> = {
  official: {
    name: 'Official',
    def: 'Direct government or OHCHR reports admitted via the source allowlist.',
  },
  confirmed: {
    name: 'Confirmed',
    def: 'Named-dead records from reputable sources (e.g. Mediazona, memorials).',
  },
  osint: {
    name: 'OSINT',
    def: 'Cross-corroborated reports — ≥2 corroborators, no contradictions.',
  },
  ai_corroborated: {
    name: 'AI-corroborated',
    def: 'Provisional tier from Claude when evidence passes semantic matching but lacks full confirmation. Counts immediately; queued for human audit.',
  },
};

const TIERS = (Object.keys(TIER_RANK) as (keyof typeof TIER_RANK)[])
  .sort((a, b) => TIER_RANK[b] - TIER_RANK[a])
  .map((key) => TIER_DEFS[key]);

/** Methodology (M5·T0.3). Thresholds/weights are read from tiering.config so the
 *  page cannot drift from the code that actually tiers evidence. Static. */
export default function MethodologyPage() {
  const w = MATCH_WEIGHTS;
  const osint = TIER_THRESHOLDS.osint;
  const ai = TIER_THRESHOLDS.aiCorroborated;
  const gray = TIER_THRESHOLDS.grayBand;
  const nearDup = TIER_THRESHOLDS.nearDup;
  const headline = DEFAULT_HEADLINE_THRESHOLD === 'confirmed' ? 'Official + Confirmed' : 'Official';
  return (
    <main className="prose">
      <h1>Methodology</h1>
      <p>
        PeaceClock publishes a <strong>lower bound</strong> on casualties: a death is counted only when
        evidence clears an explicit authentication bar. The headline defaults to <strong>{headline}</strong>{' '}
        (<code>DEFAULT_HEADLINE_THRESHOLD = {DEFAULT_HEADLINE_THRESHOLD}</code>).
      </p>

      <h2>Authentication tiers</h2>
      <table className="matrix__table">
        <thead><tr><th scope="col">Tier</th><th scope="col">Definition</th></tr></thead>
        <tbody>
          {TIERS.map((t) => (
            <tr key={t.name}><th scope="row">{t.name}</th><td>{t.def}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Match score</h2>
      <p>Each candidate is scored on four sub-dimensions in [0,1], combined with fixed weights (from code):</p>
      <ul>
        <li>Where — {(w.where * 100).toFixed(0)}%</li>
        <li>When — {(w.when * 100).toFixed(0)}%</li>
        <li>What — {(w.what * 100).toFixed(0)}%</li>
        <li>Who — {(w.who * 100).toFixed(0)}%</li>
      </ul>
      <p>
        Candidates count toward corroboration only above a floor of <code>s ≥ {SCORE_FLOOR}</code>.
        OSINT requires <code>s ≥ {osint.matchScore}</code> with ≥{osint.minCorroborators} corroborators and{' '}
        {osint.maxContradictions} contradictions. AI-corroborated applies for{' '}
        <code>{ai.matchScoreMin} ≤ s &lt; {ai.matchScoreMax}</code> with ≥{ai.minCorroborators} corroborator.
        Dedup/merge triggers at <code>s ≥ {TIER_THRESHOLDS.dedup}</code> against an already-counted casualty.
        Near-duplicate matches in <code>{nearDup.matchScoreMin} ≤ s &lt; {nearDup.matchScoreMax}</code> escalate
        for review. The gray band <code>{gray.matchScoreMin} ≤ s &lt; {gray.matchScoreMax}</code> also escalates
        to Opus. Contradictions are only outweighed when corroborators exceed contradictions by at least{' '}
        <code>{CONTRADICTION_CLEAR_MARGIN}</code>.
      </p>

      <h2>AI corroboration &amp; audit</h2>
      <p>
        Claude (Haiku 4.5) returns sub-scores only; the composite score and tier are computed in code, not
        by the model. Borderline and contradictory cases escalate to Claude Opus 4.8. Every AI-assigned tier
        and auto-geolocation lands in a human-audit queue and is logged immutably.
      </p>

      <h2>Neutrality &amp; coverage</h2>
      <p>
        A belligerent&apos;s claims about its own losses are stored for context but never used to confirm counts.
        Source coverage differs by side, so per-side figures reflect <em>evidence availability</em>, not the full
        toll. We never present a confirmed count as the complete picture.
      </p>
      <SiteFooter />
    </main>
  );
}
