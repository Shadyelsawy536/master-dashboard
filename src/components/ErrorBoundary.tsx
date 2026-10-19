import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '../lib/observability';

type Props = { children: ReactNode };
type State = { hasError: boolean; correlationId?: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    const event = captureException(error, 'react.error-boundary');
    this.setState({ hasError: true, correlationId: event.correlationId });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-ink">
          <div className="max-w-lg rounded-xl border border-line bg-surface p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-ink/60">
              The error was captured in this browser session. Please reload the page. If the problem continues,
              share this reference with support.
            </p>
            {this.state.correlationId && (
              <p className="mt-4 break-all rounded bg-canvas p-2 font-mono text-xs">
                Reference: {this.state.correlationId}
              </p>
            )}
            <button
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
