import { NextRequest, NextResponse } from 'next/server';
import { documentsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { sensitiveRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:documents-verify');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting for sensitive operations
    const rateLimitResult = await sensitiveRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Get the document
    const document = await documentsService.getDocument(id);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Authorization check - get the case and verify user is the attorney
    const caseData = await casesService.getCase(document.case_id);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Only the attorney assigned to this case can verify documents
    if (caseData.attorney_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the assigned attorney can verify documents' },
        { status: 403 }
      );
    }

    const verifiedDocument = await documentsService.verifyDocument(id);

    return NextResponse.json(verifiedDocument);
  } catch (error) {
    log.logError('Error verifying document', error);
    return NextResponse.json(
      { error: 'Failed to verify document' },
      { status: 500 }
    );
  }
}
