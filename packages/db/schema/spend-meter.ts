/**
 * Spend meter table for AI cost tracking (T0.5, EDD §8.1)
 * Tracks monthly usage against the budget cap.
 */

import { pgTable, date, numeric, primaryKey } from 'drizzle-orm/pg-core';

export const spendMeter = pgTable(
  'spend_meter',
  {
    month: date('month').notNull(), // first day of the month
    usd: numeric('usd', { precision: 10, scale: 4 }).default('0.0000'),
    capUsd: numeric('cap_usd', { precision: 10, scale: 4 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.month] }),
  })
);
