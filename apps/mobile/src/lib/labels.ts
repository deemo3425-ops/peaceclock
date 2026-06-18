import { Side, Audience, Category, Tier } from '@peaceclock/api-types';
import type { Window } from '@peaceclock/count-engine';

export const SIDE_LABEL: Record<Side, string> = {
  [Side.UA_COALITION]: 'Ukraine coalition',
  [Side.RUSSIA]: 'Russia',
};

export const AUDIENCE_LABEL: Record<Audience, string> = {
  [Audience.CIVILIAN]: 'Civilian',
  [Audience.MILITARY]: 'Military',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  [Category.KILLED]: 'Killed',
  [Category.WOUNDED]: 'Wounded',
  [Category.MISSING_POW]: 'Missing / POW',
};

export const WINDOW_LABEL: Record<Window, string> = {
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  '1y': '1y',
  total: 'Total',
};

export const TIER_ORDER: Tier[] = [Tier.OFFICIAL, Tier.CONFIRMED, Tier.OSINT, Tier.AI_CORROBORATED];

export const TIER_LABEL: Record<Tier, string> = {
  [Tier.OFFICIAL]: 'Official',
  [Tier.CONFIRMED]: 'Official + Confirmed',
  [Tier.OSINT]: '+ OSINT',
  [Tier.AI_CORROBORATED]: '+ AI-corroborated',
};

export const DEFAULT_THRESHOLD = Tier.CONFIRMED;