import { NextRequest, NextResponse } from 'next/server';
import { casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createCaseSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  visa_type: z.string(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority_date: z.string().optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const filters = {
      status: searchParams.getAll('status').length > 0
        ? searchParams.getAll('status')
        : searchParams.get('status') || undefined,
      visa_type: searchParams.getAll('visa_type').length > 0
        ? searchParams.getAll('visa_type')
        : searchParams.get('visa_type') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const pagination = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      sortBy: searchParams.get('sortBy') || 'created_at',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
    };

    const result = await casesService.getCases(filters as Parameters<typeof casesService.getCases>[0], pagination);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cases' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
        { error: 'Only attorneys can create cases' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createCaseSchema.parse(body);

    const newCase = await casesService.createCase(validatedData as Parameters<typeof casesService.createCase>[0]);

    return NextResponse.json(newCase, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating case:', error);
    return NextResponse.json(
      { error: 'Failed to create case' },
      { status: 500 }
    );
  }
}
