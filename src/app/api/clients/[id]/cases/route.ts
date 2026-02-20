import { withAuth, errorResponse, successResponse } from '@/lib/auth/api-helpers';
import { clientsService } from '@/lib/db/clients';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:client-cases');

export const GET = withAuth(async (_request, context, auth) => {
  try {
    const { id: clientId } = await context.params!;

    // Authorization check
    // Client can only view their own cases
    // Attorney can only view cases for clients they work with
    if (auth.profile.role === 'client') {
      if (auth.user.id !== clientId) {
        return errorResponse('Clients can only view their own cases', 403);
      }
    } else if (auth.profile.role === 'attorney') {
      const supabase = await createClient();
      const { data: sharedCases } = await supabase
        .from('cases')
        .select('id')
        .eq('attorney_id', auth.user.id)
        .eq('client_id', clientId)
        .limit(1);

      if (!sharedCases || sharedCases.length === 0) {
        return errorResponse('You do not have access to this client\'s cases', 403);
      }
    } else {
      return errorResponse('Invalid user role', 403);
    }

    const cases = await clientsService.getClientCases(clientId);
    return successResponse(cases);
  } catch (error) {
    log.logError('Error fetching client cases', error);
    return errorResponse('Failed to fetch client cases', 500);
  }
});
