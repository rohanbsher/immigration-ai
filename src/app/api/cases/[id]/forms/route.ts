import { NextRequest, NextResponse } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { standardRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { FORM_TYPES } from '@/lib/validation';

const log = createLogger('api:case-forms');

const createFormSchema = z.object({
  form_type: z.enum(FORM_TYPES, { message: 'Invalid form type' }),
  form_data: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Verify user has access to this case (is attorney or client).
 * Returns null if no access, otherwise returns role info.
 */
async function verifyCaseAccess(userId: string, caseId: string): Promise<{ hasAccess: boolean; isAttorney: boolean } | null> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return null;
  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;
  if (!isAttorney && !isClient) return null;
  return { hasAccess: true, isAttorney };
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
    const access = await verifyCaseAccess(user.id, caseId);
    if (!access) {
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
    const access = await verifyCaseAccess(user.id, caseId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only the case's attorney can create forms
    if (!access.isAttorney) {
      return NextResponse.json(
        { error: 'Only the case attorney can create forms' },
        { status: 403 }
      );
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
