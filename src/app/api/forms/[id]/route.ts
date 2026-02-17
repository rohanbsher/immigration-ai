import { NextRequest, NextResponse } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { auditService } from '@/lib/audit';
import { z } from 'zod';
import { standardRateLimiter, sensitiveRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { FORM_STATUSES, isValidFormTransition, type FormStatusType } from '@/lib/validation';
import { safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:forms-detail');

const updateFormSchema = z.object({
  status: z.enum(FORM_STATUSES, { message: 'Invalid form status' }).optional(),
  form_data: z.record(z.string(), z.unknown()).optional(),
  review_notes: z.string().nullable().optional(),
});

/**
 * Verify that the current user can access this form via its case.
 * Returns the form if accessible, along with permission flags.
 */
async function getFormWithAccess(userId: string, formId: string): Promise<{
  form: Awaited<ReturnType<typeof formsService.getForm>>;
  canModify: boolean;
  isAttorney: boolean;
} | null> {
  const form = await formsService.getForm(formId);

  if (!form) {
    return null;
  }

  // Get the case to check access
  const caseData = await casesService.getCase(form.case_id);

  if (!caseData) {
    return null;
  }

  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;

  if (!isAttorney && !isClient) {
    return null;
  }

  return {
    form,
    canModify: isAttorney, // Only attorneys can modify forms
    isAttorney,
  };
}

export async function GET(
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

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const accessResult = await getFormWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json(accessResult.form);
  } catch (error) {
    log.logError('Error fetching form', error);
    return NextResponse.json(
      { error: 'Failed to fetch form' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const accessResult = await getFormWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (!accessResult.canModify) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const validatedData = updateFormSchema.parse(body);

    // Get the current form state for audit comparison
    const currentForm = accessResult.form;

    // Validate form status transition if status is being changed
    if (validatedData.status && currentForm) {
      const currentStatus = currentForm.status as FormStatusType;
      const newStatus = validatedData.status as FormStatusType;
      if (!isValidFormTransition(currentStatus, newStatus)) {
        return NextResponse.json(
          { error: `Invalid status transition from '${currentStatus}' to '${newStatus}'` },
          { status: 400 }
        );
      }
    }

    // Track which fields are being modified
    const modifiedFields: Record<string, { old: unknown; new: unknown }> = {};

    // Compare form_data changes to identify AI field modifications
    if (validatedData.form_data && currentForm) {
      const currentFormData = currentForm.form_data as Record<string, unknown>;
      const aiFilledData = currentForm.ai_filled_data as Record<string, unknown> | null;

      for (const [key, newValue] of Object.entries(validatedData.form_data)) {
        const oldValue = currentFormData[key];
        const isAiField = aiFilledData && key in aiFilledData;

        // Track changes, especially to AI-filled fields
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          modifiedFields[key] = {
            old: oldValue,
            new: newValue,
          };

          // If this is an AI-filled field being modified, note that specifically
          if (isAiField) {
            modifiedFields[key] = {
              ...modifiedFields[key],
              old: aiFilledData[key], // Use original AI value
            };
          }
        }
      }
    }

    // When status is changing, use CAS (Compare-and-Swap) to prevent TOCTOU races.
    // Without this, two concurrent requests could both validate the same transition
    // and both succeed, even though the second should see the updated status.
    let updatedForm;
    if (validatedData.status && currentForm) {
      const currentStatus = currentForm.status;
      const { data: casResult, error: casError } = await supabase
        .from('forms')
        .update(validatedData)
        .eq('id', id)
        .eq('status', currentStatus)
        .is('deleted_at', null)
        .select()
        .single();

      if (casError || !casResult) {
        return NextResponse.json(
          { error: 'Form status changed concurrently. Please refresh and try again.' },
          { status: 409 }
        );
      }
      updatedForm = casResult;
    } else {
      updatedForm = await formsService.updateForm(id, validatedData as Parameters<typeof formsService.updateForm>[1]);
    }

    // Log audit trail for attorney modifications
    if (Object.keys(modifiedFields).length > 0) {
      await auditService.log({
        table_name: 'forms',
        record_id: id,
        operation: 'update',
        old_values: Object.fromEntries(
          Object.entries(modifiedFields).map(([k, v]) => [k, v.old])
        ),
        new_values: Object.fromEntries(
          Object.entries(modifiedFields).map(([k, v]) => [k, v.new])
        ),
        additional_context: {
          action: 'form_field_modification',
          modified_fields: Object.keys(modifiedFields),
          form_type: currentForm?.form_type,
          form_status: currentForm?.status,
          has_ai_data: !!(currentForm?.ai_filled_data),
        },
      });
    }

    return NextResponse.json(updatedForm);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    log.logError('Error updating form', error);
    return NextResponse.json(
      { error: 'Failed to update form' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Rate limit check (using sensitive for destructive actions)
    const rateLimitResult = await sensitiveRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const accessResult = await getFormWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (!accessResult.canModify) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Log deletion in audit trail before deleting
    await auditService.logDelete('forms', id, {
      form_type: accessResult.form?.form_type,
      form_status: accessResult.form?.status,
      case_id: accessResult.form?.case_id,
    });

    await formsService.deleteForm(id);

    return NextResponse.json({ message: 'Form deleted successfully' });
  } catch (error) {
    log.logError('Error deleting form', error);
    return NextResponse.json(
      { error: 'Failed to delete form' },
      { status: 500 }
    );
  }
}
