import { NextRequest, NextResponse } from 'next/server';
import { casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { sendCaseUpdateEmail } from '@/lib/email/notifications';

const updateCaseSchema = z.object({
  visa_type: z.string().optional(),
  status: z.string().optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priority_date: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Verify that the current user can access this case.
 * Returns the case data if accessible, null otherwise.
 * Also returns the user's role for permission checks.
 */
async function getCaseWithAccess(userId: string, caseId: string): Promise<{
  case: Awaited<ReturnType<typeof casesService.getCase>>;
  canModify: boolean;
} | null> {
  const caseData = await casesService.getCase(caseId);

  if (!caseData) {
    return null;
  }

  // Check if user is the attorney or client on this case
  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;

  if (!isAttorney && !isClient) {
    return null;
  }

  return {
    case: caseData,
    canModify: isAttorney, // Only attorneys can modify cases
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

    const accessResult = await getCaseWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json(accessResult.case);
  } catch (error) {
    console.error('Error fetching case:', error);
    return NextResponse.json(
      { error: 'Failed to fetch case' },
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

    const accessResult = await getCaseWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!accessResult.canModify) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateCaseSchema.parse(body);

    // Track if status changed for email notification
    const caseData = accessResult.case;
    const previousStatus = caseData?.status;
    const statusChanged = validatedData.status && validatedData.status !== previousStatus;

    const updatedCase = await casesService.updateCase(id, validatedData as Parameters<typeof casesService.updateCase>[1]);

    // Send email notification on status change (fire and forget)
    if (statusChanged && validatedData.status) {
      sendCaseUpdateEmail(
        id,
        'status_change',
        `Case status changed from "${previousStatus}" to "${validatedData.status}"`,
        user.id
      ).catch((err) => {
        console.error('Failed to send case update email:', err);
      });
    }

    return NextResponse.json(updatedCase);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating case:', error);
    return NextResponse.json(
      { error: 'Failed to update case' },
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

    const accessResult = await getCaseWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!accessResult.canModify) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await casesService.deleteCase(id);

    return NextResponse.json({ message: 'Case deleted successfully' });
  } catch (error) {
    console.error('Error deleting case:', error);
    return NextResponse.json(
      { error: 'Failed to delete case' },
      { status: 500 }
    );
  }
}
