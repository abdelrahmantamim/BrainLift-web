import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { trackError } from '../utils/analytics';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    trackError(error, { componentStack: errorInfo.componentStack });
  }


  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-pg-cream">
          <div className="pg-card shadow-clay-coral max-w-md w-full p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-pg-coral mx-auto mb-4" />
            <h1 className="text-2xl font-heading font-bold text-pg-navy mb-2">Oops! Something went wrong</h1>
            <p className="text-pg-text-secondary font-body mb-6">
              We're sorry for the inconvenience. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-pg-text-secondary font-body">
                  Error details
                </summary>
                <pre className="mt-2 p-2 bg-pg-cream rounded-lg border-2 border-pg-navy/20 text-xs overflow-auto text-pg-navy font-mono">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="pg-btn pg-btn-coral inline-flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}