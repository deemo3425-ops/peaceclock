/**
 * OpenTelemetry baseline setup (T0.5)
 * Minimal instrumentation; expanded in M7 for production.
 */

export function initOtel() {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    console.debug('[otel] no endpoint configured, skipping');
    return;
  }

  // Stub: full OTel setup in M7 (polish/launch)
  console.debug('[otel] initialized', { endpoint });
}
