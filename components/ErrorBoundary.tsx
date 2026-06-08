"use client";
import { Component, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface Props {
  children: ReactNode;
  fallback?: (props: { error: Error; reset: () => void; eventId: string | null }) => ReactNode;
}

interface State {
  error: Error | null;
  eventId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, eventId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    const eventId = Sentry.captureException(error);
    this.setState({ eventId });
  }

  reset = () => this.setState({ error: null, eventId: null });

  render() {
    const { error, eventId } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.reset, eventId });
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <p className="text-sm text-gray-500">Dieser Bereich konnte nicht geladen werden.</p>
        {eventId && (
          <p className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded">
            ID: {eventId}
          </p>
        )}
        <button
          onClick={this.reset}
          className="text-sm px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-800 transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }
}
