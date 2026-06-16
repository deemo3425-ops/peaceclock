/**
 * Environment variable validation (T0.4)
 * Called at app boot; throws if required vars are missing.
 */

const required = ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'VOYAGE_API_KEY'];

export function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. See .env.example.`
    );
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  voyageApiKey: process.env.VOYAGE_API_KEY!,
  otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
};
