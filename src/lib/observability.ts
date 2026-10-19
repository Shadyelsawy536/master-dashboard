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

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function redact(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[redacted-number]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[redacted]')
    .replace(/\b(sk_live_|sk_test_|pk_live_|pk_test_)[A-Za-z0-9_-]+/gi, '[redacted-key]');
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

  return logDiagnostic('error', message, source, correlationId);
}

export function initializeObservability(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    captureException(event.error ?? event.message, 'window.error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureException(event.reason, 'window.unhandledrejection');
  });

  logDiagnostic('info', 'Frontend diagnostic capture initialized', 'observability.bootstrap');
}
