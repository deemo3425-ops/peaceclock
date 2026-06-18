-- Optional E2E fixture: minimal daily_agg rows for counter/map smoke tests.
-- Safe to re-run (upserts on primary key).

INSERT INTO daily_agg (day, theater, side, category, audience, tier, count)
VALUES
  ('2023-06-01', 'ukraine', 'ua_coalition', 'killed', 'military', 'official', 12),
  ('2023-06-01', 'ukraine', 'ua_coalition', 'wounded', 'military', 'official', 4),
  ('2023-06-01', 'ukraine', 'russia', 'killed', 'military', 'confirmed', 7)
ON CONFLICT ON CONSTRAINT pk_daily_agg DO UPDATE SET count = EXCLUDED.count;