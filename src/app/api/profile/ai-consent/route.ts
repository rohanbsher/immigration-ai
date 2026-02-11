import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:ai-consent');

/**
 * POST /api/profile/ai-consent
 * Grant AI consent — sets ai_consent_granted_at on the caller's profile.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ai_consent_granted_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      log.logError('Failed to grant AI consent', error);
      return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
    }

    return NextResponse.json({ message: 'AI consent granted' });
  } catch (error) {
    log.logError('Error granting AI consent', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/ai-consent
 * Revoke AI consent — sets ai_consent_granted_at to NULL.
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ai_consent_granted_at: null })
      .eq('id', user.id);

    if (error) {
      log.logError('Failed to revoke AI consent', error);
      return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
    }

    return NextResponse.json({ message: 'AI consent revoked' });
  } catch (error) {
    log.logError('Error revoking AI consent', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
