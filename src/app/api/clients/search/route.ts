import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientsService } from '@/lib/db/clients';
import { sensitiveRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clients-search');

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Authorization: Only attorneys can search clients
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'attorney') {
      return NextResponse.json(
        { error: 'Only attorneys can search clients' },
        { status: 403 }
      );
    }

    // Rate limiting: 20 requests per minute (prevent enumeration attacks)
    const rateLimitResult = await sensitiveRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return NextResponse.json([]);
    }

    const clients = await clientsService.searchClients(query);
    return NextResponse.json(clients);
  } catch (error) {
    log.logError('Error searching clients', error);
    return NextResponse.json(
      { error: 'Failed to search clients' },
      { status: 500 }
    );
  }
}
