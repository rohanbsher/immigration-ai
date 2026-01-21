import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientsService } from '@/lib/db/clients';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    // Authentication check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Authorization check
    // Client can only view their own cases
    // Attorney can only view cases for clients they work with
    if (profile?.role === 'client') {
      if (user.id !== clientId) {
        return NextResponse.json(
          { error: 'Clients can only view their own cases' },
          { status: 403 }
        );
      }
    } else if (profile?.role === 'attorney') {
      // Check if attorney has any cases with this client
      const { data: sharedCases } = await supabase
        .from('cases')
        .select('id')
        .eq('attorney_id', user.id)
        .eq('client_id', clientId)
        .limit(1);

      if (!sharedCases || sharedCases.length === 0) {
        return NextResponse.json(
          { error: 'You do not have access to this client\'s cases' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid user role' },
        { status: 403 }
      );
    }

    const cases = await clientsService.getClientCases(clientId);
    return NextResponse.json(cases);
  } catch (error) {
    console.error('Error fetching client cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client cases' },
      { status: 500 }
    );
  }
}
