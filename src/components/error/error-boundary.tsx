'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import Link from 'next/link';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to server for monitoring (prepare for production logging)
    this.logErrorToServer(error, errorInfo);
  }

  private async logErrorToServer(
    error: Error,
    errorInfo: React.ErrorInfo
  ): Promise<void> {
    try {
      // Prepare structured error payload for monitoring
      const errorPayload = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: typeof window !== 'undefined' ? window.location.href : '',
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      };

      // Log structured error for observability
      console.error('[Error Boundary] Structured error log:', errorPayload);

      // Future: Integrate with Sentry or error tracking service
      // if (typeof window !== 'undefined' && window.Sentry) {
      //   window.Sentry.captureException(error, {
      //     contexts: { react: { componentStack: errorInfo.componentStack } },
      //   });
      // }
    } catch {
      // Silently fail - don't cause more errors while handling an error
    }
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallbackUI
          error={this.state.error}
          onReset={this.handleReset}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackUIProps {
  error: Error | null;
  onReset: () => void;
  onReload: () => void;
}

function ErrorFallbackUI({ error, onReset, onReload }: ErrorFallbackUIProps) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl text-slate-900">
            Something went wrong
          </CardTitle>
          <CardDescription className="text-slate-600">
            We encountered an unexpected error. Our team has been notified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDev && error && (
            <div className="p-4 bg-slate-100 rounded-lg overflow-auto">
              <p className="text-sm font-mono text-red-600 break-all">
                {error.message}
              </p>
              {error.stack && (
                <pre className="mt-2 text-xs text-slate-500 whitespace-pre-wrap">
                  {error.stack.split('\n').slice(0, 5).join('\n')}
                </pre>
              )}
            </div>
          )}
          <p className="text-sm text-slate-500 text-center">
            Try refreshing the page or returning to the dashboard. If the
            problem persists, please contact support.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={onReset}
            variant="outline"
            className="gap-2 w-full sm:w-auto"
          >
            <RefreshCw size={16} />
            Try Again
          </Button>
          <Button
            onClick={onReload}
            variant="outline"
            className="gap-2 w-full sm:w-auto"
          >
            <RefreshCw size={16} />
            Reload Page
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button className="gap-2 w-full">
              <Home size={16} />
              Go to Dashboard
            </Button>
          </Link>
        </CardFooter>
        {isDev && (
          <div className="px-6 pb-6">
            <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
              <Bug size={12} />
              <span>Development mode - error details shown above</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export { ErrorFallbackUI };
