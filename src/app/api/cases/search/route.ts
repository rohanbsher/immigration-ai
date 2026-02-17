import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { naturalLanguageSearch } from '@/lib/ai/natural-search';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:cases-search');

const rateLimiter = createRateLimiter(RATE_LIMITS.AI_SEARCH);

/**
 * POST /api/cases/search
 *
 * Natural language case search.
 *
 * Request body:
 * {
 *   "query": "H1B cases with missing passport"
 * }
 *
 * Response:
 * {
 *   "interpretation": {
 *     "understood": "H-1B cases where passport is not uploaded",
 *     "filters": { "visaType": ["H1B"], "documentMissing": ["passport"] },
 *     "confidence": 0.9
 *   },
 *   "results": [...],
 *   "totalCount": 5,
 *   "suggestions": [...]
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

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

    // Parse request body
    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const { query } = body as { query: string };

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Query is required' },
        { status: 400 }
      );
    }

    // Limit query length
    const trimmedQuery = query.trim().slice(0, 500);

    if (trimmedQuery.length < 2) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Perform search
    const searchResponse = await naturalLanguageSearch(trimmedQuery, user.id);

    return NextResponse.json(searchResponse);
  } catch (error) {
    log.logError('Error in natural language search', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to perform search' },
      { status: 500 }
    );
  }
}
