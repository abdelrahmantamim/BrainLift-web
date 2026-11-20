import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

const DefaultErrorFallback: React.FC<{ error?: Error; resetError: () => void }> = ({
  error,
  resetError
}) => (
  <div className="pg-card shadow-clay-coral text-center py-12">
    <div className="text-pg-coral mb-4">
      <AlertTriangle className="w-12 h-12 mx-auto" />
    </div>
    <h2 className="text-2xl font-heading font-bold text-pg-coral mb-2">Something went wrong</h2>
    <p className="text-pg-text-secondary font-body mb-6">
      {error?.message || 'An unexpected error occurred while loading the dashboard.'}
    </p>
    <button
      onClick={resetError}
      className="pg-btn pg-btn-coral inline-flex items-center gap-2"
    >
      <RefreshCw className="w-4 h-4" />
      Try Again
    </button>
  </div>
);

export class DashboardErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error Boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const ErrorComponent = this.props.fallback || DefaultErrorFallback;
      return <ErrorComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

export default DashboardErrorBoundary;
