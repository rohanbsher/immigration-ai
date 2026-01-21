import { NextRequest, NextResponse } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateFormSchema = z.object({
  status: z.string().optional(),
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

    const accessResult = await getFormWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json(accessResult.form);
  } catch (error) {
    console.error('Error fetching form:', error);
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

    const accessResult = await getFormWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (!accessResult.canModify) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateFormSchema.parse(body);

    const updatedForm = await formsService.updateForm(id, validatedData as Parameters<typeof formsService.updateForm>[1]);

    return NextResponse.json(updatedForm);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating form:', error);
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

    const accessResult = await getFormWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (!accessResult.canModify) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await formsService.deleteForm(id);

    return NextResponse.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Error deleting form:', error);
    return NextResponse.json(
      { error: 'Failed to delete form' },
      { status: 500 }
    );
  }
}
