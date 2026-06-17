import { describe, it, expect } from 'vitest';
import { couldCrossHeadline } from '../corroboration/worker';
import { computeTally, applyThresholds, CandidateAssessment } from '../scoring';

const A5: CandidateAssessment[] = [
  { candidateId: 'news', where: 0.95, when: 0.9, what: 0.8, who: 0.2, relation: 'corroborates' },
  { candidateId: 'vid', where: 0.9, when: 0.85, what: 0.85, who: 0.1, relation: 'corroborates' },
  { candidateId: 'unrel', where: 0.2, when: 0.4, what: 0.5, who: 0.0, relation: 'unrelated' },
];

describe('§A.5 end-to-end decision path (pure)', () => {
  it('scores → ai_corroborated + escalate, and the Opus gate admits it', () => {
    const t = computeTally(A5);
    const d = applyThresholds({ top: t.top, c: t.c, k: t.k });
    expect(d.tier).toBe('ai_corroborated');
    expect(d.escalate).toBe(true);
    // top ≈ 0.75 ≥ OSINT_PROXIMITY → worth an Opus call.
    expect(couldCrossHeadline(t.top, d.escalationFlags)).toBe(true);
  });
});

describe('couldCrossHeadline gate (T4.1)', () => {
  const none = { nearDup: false, crossSide: false, contradiction: false };

  it('low-confidence map-only item is NOT worth Opus', () => {
    expect(couldCrossHeadline(0.66, none)).toBe(false);
  });

  it('near-dup against a counted casualty escalates regardless of top', () => {
    expect(couldCrossHeadline(0.5, { ...none, nearDup: true })).toBe(true);
  });

  it('cross-side conflict escalates', () => {
    expect(couldCrossHeadline(0.5, { ...none, crossSide: true })).toBe(true);
  });

  it('contradiction escalates', () => {
    expect(couldCrossHeadline(0.5, { ...none, contradiction: true })).toBe(true);
  });
});
