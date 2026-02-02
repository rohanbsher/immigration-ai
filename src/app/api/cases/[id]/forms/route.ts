import { NextRequest, NextResponse } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { standardRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:case-forms');

const createFormSchema = z.object({
  form_type: z.string(),
  form_data: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Verify user has access to this case (is attorney or client)
 */
async function verifyCaseAccess(userId: string, caseId: string): Promise<boolean> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return false;
  return caseData.attorney_id === userId || caseData.client_id === userId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Verify user has access to this case
    const hasAccess = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const forms = await formsService.getFormsByCase(caseId);

    return NextResponse.json(forms);
  } catch (error) {
    log.logError('Error fetching forms', error);
    return NextResponse.json(
      { error: 'Failed to fetch forms' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Verify user has access to this case
    const hasAccess = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createFormSchema.parse(body);

    const form = await formsService.createForm({
      case_id: caseId,
      form_type: validatedData.form_type as Parameters<typeof formsService.createForm>[0]['form_type'],
      form_data: validatedData.form_data,
    });

    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    log.logError('Error creating form', error);
    return NextResponse.json(
      { error: 'Failed to create form' },
      { status: 500 }
    );
  }
}
