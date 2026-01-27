'use client';

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

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('Dashboard Error:', error);

    // Future: Sentry integration with dashboard tag
    // Sentry.captureException(error, { tags: { area: 'dashboard' } });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-xl text-slate-900">
            Dashboard Error
          </CardTitle>
          <CardDescription className="text-slate-600">
            Something went wrong while loading this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="p-4 bg-slate-100 rounded-lg overflow-auto">
              <p className="text-sm font-mono text-red-600 break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-slate-500">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}
          <p className="text-sm text-slate-500 text-center">
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
