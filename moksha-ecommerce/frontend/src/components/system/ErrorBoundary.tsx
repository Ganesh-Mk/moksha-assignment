import { RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";

/**
 * The last line of defence.
 *
 * A render error anywhere below this unmounts the whole tree and leaves a blank
 * white page — the single worst failure mode a React app has, because it looks
 * identical to the site being down and gives the user nothing to act on.
 *
 * Still a class component: `getDerivedStateFromError` has no hook equivalent.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Where a real deployment would call Sentry. Logged rather than swallowed,
    // so the trace is at least in the browser console for a bug report.
    console.error("Unhandled render error", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-ink">Something broke</h1>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            This page hit an error it could not recover from. Reloading usually clears it.
          </p>
        </div>

        {/* The message, but never the stack: a trace on screen leaks file paths
            and library versions to anyone looking. */}
        <p className="max-w-sm rounded-md bg-surface-sunken px-3 py-2 font-mono text-xs text-ink-muted">
          {this.state.error.message}
        </p>

        <Button onClick={() => window.location.reload()} icon={<RotateCcw className="size-3.5" />}>
          Reload the page
        </Button>
      </div>
    );
  }
}
