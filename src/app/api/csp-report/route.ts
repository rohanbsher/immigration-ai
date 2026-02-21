import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('csp-report');

/**
 * CSP violation reporting endpoint.
 * Browsers POST here when Content-Security-Policy is violated.
 * This endpoint is CSRF-exempt because browsers cannot attach
 * Origin/Referer headers to report-uri POST requests.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract the nested csp-report object (standard format)
    const report = body?.['csp-report'] ?? body;

    log.warn('CSP violation', {
      blockedUri: report?.['blocked-uri'],
      violatedDirective: report?.['violated-directive'],
      documentUri: report?.['document-uri'],
      originalPolicy: report?.['original-policy']?.substring(0, 200),
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    // Malformed reports should not crash the endpoint
    return new NextResponse(null, { status: 204 });
  }
}
