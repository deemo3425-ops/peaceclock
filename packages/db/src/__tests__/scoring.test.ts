import { describe, it, expect } from 'vitest';
import {
  computeTally,
  applyThresholds,
  escalationTriggers,
  CandidateAssessment,
  ASSESSMENT_SCHEMA,
} from '../scoring';

// ── §A.5 worked example fixtures ─────────────────────────────────────────────

const A5: CandidateAssessment[] = [
  { candidateId: 'news-junction', where: 0.95, when: 0.9, what: 0.8, who: 0.2, relation: 'corroborates' },
  { candidateId: 'x-video-2', where: 0.9, when: 0.85, what: 0.85, who: 0.1, relation: 'corroborates' },
  { candidateId: 'kupiansk', where: 0.2, when: 0.4, what: 0.5, who: 0.0, relation: 'unrelated' },
];

describe('computeTally (§A.5 Step 1–2)', () => {
  it('row 1 s = 0.75, row 2 s = 0.715 (PRD prints 0.74/0.71 — rounding)', () => {
    const t = computeTally(A5);
    const news = t.scored.find((s) => s.candidateId === 'news-junction')!;
    const vid = t.scored.find((s) => s.candidateId === 'x-video-2')!;
    expect(news.s).toBeCloseTo(0.75, 3); // 0.285+0.225+0.20+0.04
    expect(vid.s).toBeCloseTo(0.715, 3); // 0.27+0.2125+0.2125+0.02
  });

  it('c = 2, k = 0, top ≈ 0.75; unrelated 0.30 ignored', () => {
    const t = computeTally(A5);
    expect(t.c).toBe(2);
    expect(t.k).toBe(0);
    expect(t.top).toBeCloseTo(0.75, 3);
    expect(t.scored).toHaveLength(2);
  });

  it('floor excludes corroborating items below 0.60', () => {
    const t = computeTally([
      { candidateId: 'weak', where: 0.5, when: 0.5, what: 0.5, who: 0.5, relation: 'corroborates' }, // s=0.5
    ]);
    expect(t.c).toBe(0);
    expect(t.scored).toHaveLength(0);
  });
});

describe('applyThresholds (§A.5 Step 3)', () => {
  it('A.5 → ai_corroborated + escalate (gray band 0.74 ∈ 0.65–0.78)', () => {
    const t = computeTally(A5);
    const d = applyThresholds({ top: t.top, c: t.c, k: t.k });
    expect(d.tier).toBe('ai_corroborated');
    expect(d.action).toBe('count');
    expect(d.escalate).toBe(true);
    expect(d.escalationFlags.grayBand).toBe(true);
  });

  it('dedup: s ≥ 0.90 vs counted canonical → merge, no new count', () => {
    const d = applyThresholds({
      top: 0.95,
      c: 1,
      k: 0,
      dedup: { s: 0.95, isCountedCanonical: true, targetCasualtyId: 'cas-1' },
    });
    expect(d.action).toBe('merge');
    expect(d.tier).toBeNull();
    expect(d.dedupTargetId).toBe('cas-1');
  });

  it('dedup ignored when target is not a counted casualty', () => {
    const d = applyThresholds({
      top: 0.92,
      c: 2,
      k: 0,
      dedup: { s: 0.92, isCountedCanonical: false, targetCasualtyId: 'ev-1' },
    });
    expect(d.action).not.toBe('merge');
  });

  it('OSINT: s ≥ 0.85, c ≥ 2, k = 0', () => {
    const d = applyThresholds({ top: 0.88, c: 2, k: 0 });
    expect(d.tier).toBe('osint');
    expect(d.action).toBe('count');
  });

  it('k ≥ c → unverified (contradictions dominate)', () => {
    const d = applyThresholds({ top: 0.9, c: 1, k: 1 });
    expect(d.action).toBe('unverified');
    expect(d.tier).toBeNull();
  });

  it('s < 0.70 → unverified', () => {
    const d = applyThresholds({ top: 0.68, c: 1, k: 0 });
    expect(d.action).toBe('unverified');
  });
});

describe('escalationTriggers (§A.3 rule 5)', () => {
  it('gray band 0.65–0.78', () => {
    expect(escalationTriggers({ top: 0.7, c: 1, k: 0 }).grayBand).toBe(true);
    expect(escalationTriggers({ top: 0.8, c: 1, k: 0 }).grayBand).toBe(false);
  });

  it('contradiction not clearly outweighed', () => {
    expect(escalationTriggers({ top: 0.9, c: 2, k: 1 }).contradiction).toBe(true); // c-k=1 < margin 2
    expect(escalationTriggers({ top: 0.9, c: 4, k: 1 }).contradiction).toBe(false); // c-k=3 ≥ 2
  });

  it('near-dup 0.85 ≤ s < 0.90 vs counted', () => {
    expect(
      escalationTriggers({ top: 0.87, c: 2, k: 0, dedup: { s: 0.87, isCountedCanonical: true, targetCasualtyId: 'c' } }).nearDup,
    ).toBe(true);
  });

  it('cross-side and sensitive flags pass through', () => {
    expect(escalationTriggers({ top: 0.9, c: 2, k: 0, crossSideConflict: true }).crossSide).toBe(true);
    expect(escalationTriggers({ top: 0.9, c: 2, k: 0, sensitiveMedia: true }).sensitive).toBe(true);
  });

  it('each trigger independently routes to escalate; clean OSINT does not', () => {
    expect(applyThresholds({ top: 0.88, c: 2, k: 0 }).escalate).toBe(false);
    expect(applyThresholds({ top: 0.88, c: 2, k: 0, sensitiveMedia: true }).escalate).toBe(true);
  });
});

describe('ASSESSMENT_SCHEMA', () => {
  it('declares candidate sub-scores + geo, weights not in schema', () => {
    const props = ASSESSMENT_SCHEMA.properties.candidates.items.properties;
    expect(Object.keys(props)).toEqual(['candidateId', 'where', 'when', 'what', 'who', 'relation']);
    expect(ASSESSMENT_SCHEMA.properties.geo.properties.confidence.maximum).toBe(1);
  });
});

// Property-style: random (s,c,k) respects ladder invariants.
describe('ladder invariants', () => {
  it('osint ⇒ top ≥ 0.85 ∧ c ≥ 2 ∧ k = 0; ai ⇒ 0.70 ≤ top < 0.85', () => {
    for (let i = 0; i < 500; i++) {
      const top = Math.round(Math.random() * 100) / 100;
      const c = Math.floor(Math.random() * 5);
      const k = Math.floor(Math.random() * 5);
      const d = applyThresholds({ top, c, k });
      if (d.tier === 'osint') {
        expect(top).toBeGreaterThanOrEqual(0.85);
        expect(c).toBeGreaterThanOrEqual(2);
        expect(k).toBe(0);
      }
      if (d.tier === 'ai_corroborated') {
        expect(top).toBeGreaterThanOrEqual(0.7);
        expect(top).toBeLessThan(0.85);
        expect(c).toBeGreaterThan(k);
      }
      if (d.action === 'count') expect(d.tier).not.toBeNull();
    }
  });
});
