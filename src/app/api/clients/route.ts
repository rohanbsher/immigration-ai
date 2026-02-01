import { NextRequest, NextResponse } from 'next/server';
import { clientsService } from '@/lib/db/clients';
import { requireAttorney, errorResponse } from '@/lib/auth/api-helpers';
import { standardRateLimiter } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAttorney(request);
    if (!auth.success) return auth.response;

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, auth.user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const clients = await clientsService.getClients();
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return errorResponse('Failed to fetch clients', 500);
  }
}
