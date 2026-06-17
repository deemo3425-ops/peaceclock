/**
 * Environment variable validation (T0.4)
 * Call validateEnv() at runtime in API routes / server data loaders that need DB keys —
 * not at app boot (layout), so `next build` can run without live secrets.
 */

const DB_REQUIRED = ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'VOYAGE_API_KEY'];

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function validateEnv(): void {
  const missing = DB_REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. See .env.example.`
    );
  }
}

type RequestWithHeaders = {
  headers: { get(name: string): string | null };
};

/**
 * Fail-closed in production: CRON_SECRET must be set and the Authorization header must match.
 * In dev, an unset secret leaves the route open; a set secret is enforced.
 */
export function authorizeCron(request: RequestWithHeaders): boolean {
  const secret = process.env.CRON_SECRET;

  if (isProduction()) {
    if (!secret) return false;
    return request.headers.get('authorization') === `Bearer ${secret}`;
  }

  if (secret) {
    return request.headers.get('authorization') === `Bearer ${secret}`;
  }

  return true;
}

/**
 * Fail-closed in production: AUDIT_SECRET must be set and the Authorization header must match.
 * In dev, an unset secret leaves the route open; a set secret is enforced.
 */
export function authorizeAudit(request: RequestWithHeaders): boolean {
  const secret = process.env.AUDIT_SECRET;

  if (isProduction()) {
    if (!secret) return false;
    return request.headers.get('authorization') === `Bearer ${secret}`;
  }

  if (secret) {
    return request.headers.get('authorization') === `Bearer ${secret}`;
  }

  return true;
}

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  voyageApiKey: process.env.VOYAGE_API_KEY!,
  otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
};