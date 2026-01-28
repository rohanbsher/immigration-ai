import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeDocumentCompleteness } from '@/lib/ai/document-completeness';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';

const rateLimiter = createRateLimiter(RATE_LIMITS.AI_COMPLETENESS);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/completeness
 *
 * Analyzes document completeness for a case.
 * Returns missing documents, uploaded documents, and recommendations.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { id: caseId } = await params;

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to continue' },
        { status: 401 }
      );
    }

    // Rate limiting
    const limitResult = await rateLimiter.limit(request, user.id);
    if (!limitResult.allowed) {
      return limitResult.response;
    }

    // Verify user has access to this case
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, attorney_id, client_id')
      .eq('id', caseId)
      .is('deleted_at', null)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Case not found' },
        { status: 404 }
      );
    }

    // Check if user is attorney or client for this case
    if (caseData.attorney_id !== user.id && caseData.client_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this case' },
        { status: 403 }
      );
    }

    // Perform completeness analysis
    const result = await analyzeDocumentCompleteness(caseId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error analyzing document completeness:', error);

    if (error instanceof Error) {
      if (error.message === 'Case not found') {
        return NextResponse.json(
          { error: 'Not Found', message: 'Case not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to analyze document completeness' },
      { status: 500 }
    );
  }
}
