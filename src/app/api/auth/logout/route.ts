import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:auth-logout');

export async function POST() {
  try {
    const supabase = await createClient();

    // Verify user is actually logged in before signing out
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      log.warn('Logout failed', { userId: user.id });
      return NextResponse.json(
        { error: 'Logout failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    log.logError('Logout error', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
