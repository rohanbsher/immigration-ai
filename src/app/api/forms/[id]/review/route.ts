import { NextRequest, NextResponse } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const reviewSchema = z.object({
  notes: z.string().optional().default(''),
});

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

    // Get the form
    const form = await formsService.getForm(id);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Get the case to verify attorney has access
    const caseData = await casesService.getCase(form.case_id);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Only the attorney assigned to this case can review forms
    if (caseData.attorney_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the assigned attorney can review forms' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { notes } = reviewSchema.parse(body);

    const reviewedForm = await formsService.reviewForm(id, notes);

    return NextResponse.json(reviewedForm);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error reviewing form:', error);
    return NextResponse.json(
      { error: 'Failed to review form' },
      { status: 500 }
    );
  }
}
