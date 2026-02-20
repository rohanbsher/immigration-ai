'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createLogger } from '@/lib/logger';

const log = createLogger('analytics-error');

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AnalyticsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    log.logError('Analytics Error', error, { digest: error.digest });
    Sentry.captureException(error, { tags: { area: 'analytics' } });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-warning" />
          </div>
          <CardTitle className="text-xl text-foreground">
            Analytics Error
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Something went wrong while loading analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="p-4 bg-muted rounded-lg overflow-auto">
              <p className="text-sm font-mono text-destructive break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            This error has been logged. Try refreshing or navigate to a
            different page.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            variant="outline"
            className="gap-2 w-full sm:w-auto"
          >
            <RefreshCw size={16} />
            Try Again
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="outline" className="gap-2 w-full">
              <ArrowLeft size={16} />
              Dashboard Home
            </Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button className="gap-2 w-full">
              <Home size={16} />
              Home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
