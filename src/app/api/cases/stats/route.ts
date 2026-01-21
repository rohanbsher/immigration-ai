import { NextResponse } from 'next/server';
import { casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await casesService.getCaseStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching case stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch case stats' },
      { status: 500 }
    );
  }
}
