import { NextRequest, NextResponse } from 'next/server';
import { formsService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

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

    // Check if user is an attorney
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'attorney') {
      return NextResponse.json(
        { error: 'Only attorneys can mark forms as filed' },
        { status: 403 }
      );
    }

    // Check if form is approved before filing
    const form = await formsService.getForm(id);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (form.status !== 'approved') {
      return NextResponse.json(
        { error: 'Form must be approved before filing' },
        { status: 400 }
      );
    }

    const filedForm = await formsService.markAsFiled(id);

    return NextResponse.json(filedForm);
  } catch (error) {
    console.error('Error filing form:', error);
    return NextResponse.json(
      { error: 'Failed to mark form as filed' },
      { status: 500 }
    );
  }
}
