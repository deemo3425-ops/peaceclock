/**
 * OpenTelemetry baseline setup (T0.5, M7·WS3)
 * Minimal Node tracer + span helpers for API routes and cron handlers.
 */

import { trace, context, SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let provider: NodeTracerProvider | null = null;
let tracer: Tracer | null = null;

export function initOtel(): void {
  if (provider) return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    console.debug('[otel] no endpoint configured, skipping');
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'peaceclock-web';

  provider = new NodeTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
  });
  provider.addSpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter({ url: endpoint })),
  );
  provider.register();

  tracer = trace.getTracer('peaceclock-web');
  console.debug('[otel] initialized', { endpoint, serviceName });
}

function getTracer(): Tracer {
  if (!tracer) {
    tracer = trace.getTracer('peaceclock-web');
  }
  return tracer;
}

/**
 * Run an async function inside a named span. Records exceptions and sets OK/ERROR status.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const activeTracer = getTracer();
  return activeTracer.startActiveSpan(name, async (span) => {
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export { trace, context, SpanStatusCode };
export type { Span };