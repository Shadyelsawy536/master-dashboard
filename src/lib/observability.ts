import * as Sentry from '@sentry/react';

export type LogLevel = 'info' | 'warning' | 'error';

export type DiagnosticEvent = {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  correlationId: string;
};

type EventListener = (events: DiagnosticEvent[]) => void;

const MAX_EVENTS = 50;
const recentEvents: DiagnosticEvent[] = [];
const listeners = new Set<EventListener>();
let initialized = false;
let sentryEnabled = false;

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function redact(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\\b(?:\\+?\\d[\\d\\s().-]{7,}\\d)\\b/g, '[redacted-number]')
    .replace(/(Bearer\\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[redacted]')
    .replace(/\\b(password|passwd|secret|token|authorization|api[_-]?key|client[_-]?secret|merchant[_-]?secret)\\b\\s*[:=]\\s*[\"']?[^\\s,\"'}]+/gi, '$1=[redacted]')
    .replace(/\\b(sk_live_|sk_test_|pk_live_|pk_test_)[A-Za-z0-9_-]+/gi, '[redacted-key]');
}

function publish(event: DiagnosticEvent): void {
  recentEvents.unshift(event);
  if (recentEvents.length > MAX_EVENTS) recentEvents.length = MAX_EVENTS;
  const snapshot = [...recentEvents];
  listeners.forEach((listener) => listener(snapshot));
}

export function getRecentDiagnostics(): DiagnosticEvent[] {
  return [...recentEvents];
}

export function subscribeDiagnostics(listener: EventListener): () => void {
  listeners.add(listener);
  listener(getRecentDiagnostics());
  return () => listeners.delete(listener);
}

export function logDiagnostic(
  level: LogLevel,
  message: string,
  source = 'master-dashboard',
  correlationId = makeId(),
): DiagnosticEvent {
  const event: DiagnosticEvent = {
    id: makeId(),
    timestamp: new Date().toISOString(),
    level,
    source,
    message: redact(message).slice(0, 1000),
    correlationId,
  };

  publish(event);

  const serialized = JSON.stringify(event);
  if (level === 'error') console.error('[observability]', serialized);
  else if (level === 'warning') console.warn('[observability]', serialized);
  else console.info('[observability]', serialized);

  return event;
}

export function captureException(
  error: unknown,
  source = 'master-dashboard',
  correlationId = makeId(),
): DiagnosticEvent {
  const message = error instanceof Error
    ? `${error.name}: ${error.message}`
    : typeof error === 'string'
      ? error
      : 'An unknown error was thrown';

  const event = logDiagnostic('error', message, source, correlationId);

  // Send only the already-redacted message instead of the raw Error object,
  // which may contain user data in its message or metadata.
  if (sentryEnabled) {
    Sentry.captureMessage(event.message, {
      level: 'error',
      tags: { source: event.source },
      contexts: {
        diagnostics: {
          correlationId: event.correlationId,
          diagnosticId: event.id,
        },
      },
    });
  }

  return event;
}

export function initializeObservability(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const runtimeEnv = (import.meta as ImportMeta & { env?: { VITE_SENTRY_DSN?: string; DEV?: boolean } }).env;
  const dsn = runtimeEnv?.VITE_SENTRY_DSN?.trim();
  if (dsn) {
    Sentry.init({
      dsn,
      integrations: (defaults) => [
        ...defaults.filter((integration) => integration.name !== 'GlobalHandlers'),
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          maskAllInputs: true,
          blockAllMedia: true,
        }),
      ],
      sendDefaultPii: false,
      tracesSampleRate: runtimeEnv?.DEV ? 1.0 : 0.1,
      // Avoid recording ordinary sessions; keep replay available for errors.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event) {
        delete event.user;

        if (event.request?.url) {
          try {
            const url = new URL(event.request.url);
            url.search = '';
            url.hash = '';
            event.request.url = url.toString();
          } catch {
            event.request.url = '[redacted-url]';
          }
        }

        if (event.request?.headers) event.request.headers = {};

        event.breadcrumbs?.forEach((breadcrumb) => {
          const url = breadcrumb.data?.url;
          if (typeof url === 'string') {
            try {
              const parsed = new URL(url);
              parsed.search = '';
              parsed.hash = '';
              breadcrumb.data = { ...breadcrumb.data, url: parsed.toString() };
            } catch {
              breadcrumb.data = { ...breadcrumb.data, url: '[redacted-url]' };
            }
          }
        });

        return event;
      },
    });
    sentryEnabled = true;
  }

  window.addEventListener('error', (event) => {
    captureException(event.error ?? event.message, 'window.error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureException(event.reason, 'window.unhandledrejection');
  });

  logDiagnostic('info', 'Frontend diagnostic capture initialized', 'observability.bootstrap');
}
