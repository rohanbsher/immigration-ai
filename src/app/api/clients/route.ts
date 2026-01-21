import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientsService } from '@/lib/db/clients';

export async function GET() {
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

    // Authorization: Only attorneys can list clients
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'attorney') {
      return NextResponse.json(
        { error: 'Only attorneys can access client list' },
        { status: 403 }
      );
    }

    const clients = await clientsService.getClients();
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}
