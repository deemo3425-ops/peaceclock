/**
 * Corroboration prompt assembly (M3·WS1·T1.2, PRD §A.1/§A.2, §12).
 * The A.1/A.2 rubric is a CACHED system prefix (≈0.1× input on cache hits);
 * the per-request user content is only the variable part (new post + candidates).
 * Weights and thresholds live in code (tiering.config), NOT in the prompt — the
 * model returns sub-scores only.
 */

import { ASSESSMENT_SCHEMA } from '../scoring';
import type { Candidate } from '../candidates';

/** Static rubric — identical across calls, sent as a cached prefix. */
export const RUBRIC = `You assess whether a newly ingested war-casualty report is corroborated by prior evidence.

For each candidate prior item, rate four sub-dimensions in [0,1]:
- where: geographic agreement (same place?)
- when: temporal agreement (same date/time window?)
- what: event-type and count agreement (same kind of event, similar toll?)
- who: side/affiliation and identity agreement.

Also classify each candidate's relation to the new report:
- "corroborates": independent support for the same event.
- "contradicts": asserts something incompatible (different toll/side/outcome).
- "unrelated": a different event.

If you can localize the new report, propose a single best-guess coordinate with a
confidence in [0,1]; otherwise return geo: null. Do NOT invent precision.

Return ONLY the structured assessment via the record_assessment tool. Do not
compute any composite score or assign a tier — that is done downstream in code.`;

/** Forced tool carrying ASSESSMENT_SCHEMA as its input schema. */
export const ASSESSMENT_TOOL = {
  name: 'record_assessment',
  description: 'Record per-candidate sub-scores, relations, and an optional geolocation.',
  input_schema: ASSESSMENT_SCHEMA as unknown as Record<string, unknown>,
};

/** Per-request user content: the new post plus its K candidates. */
export function buildUserContent(newPost: string, candidates: Candidate[]): string {
  const lines = candidates.map(
    (c, i) => `Candidate ${i + 1} (id=${c.evidenceId}, source=${c.publisher}, sim=${c.sim.toFixed(2)}):\n${c.text}`,
  );
  return `NEW REPORT:\n${newPost}\n\nPRIOR CANDIDATES (${candidates.length}):\n${lines.join('\n\n')}`;
}

/** Build the system block with cache_control so the rubric is cached. */
export function systemPrefix() {
  return [{ type: 'text' as const, text: RUBRIC, cache_control: { type: 'ephemeral' as const } }];
}
