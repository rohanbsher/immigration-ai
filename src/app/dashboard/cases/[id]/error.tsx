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

const log = createLogger('case-detail-error');

interface CaseDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CaseDetailError({ error, reset }: CaseDetailErrorProps) {
  useEffect(() => {
    log.logError('Case Detail Error', error, { digest: error.digest });

    Sentry.captureException(error, { tags: { area: 'case-detail' } });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-warning" />
          </div>
          <CardTitle className="text-xl text-foreground">
            Case Loading Error
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            We were unable to load the case details. The case may have been
            removed or you may not have access.
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
            This error has been logged. Try refreshing or navigate back to your
            cases.
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
          <Link href="/dashboard/cases" className="w-full sm:w-auto">
            <Button variant="outline" className="gap-2 w-full">
              <ArrowLeft size={16} />
              Back to Cases
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
