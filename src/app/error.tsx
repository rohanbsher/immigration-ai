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
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('App Error:', error);

    // Future: Sentry integration
    // Sentry.captureException(error);
  }, [error]);

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
            We apologize for the inconvenience. An unexpected error has
            occurred.
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
            Please try again or return to the home page. If this problem
            persists, contact our support team.
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
          <Link href="/" className="w-full sm:w-auto">
            <Button className="gap-2 w-full">
              <Home size={16} />
              Go Home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
