import { NextRequest, NextResponse } from 'next/server';
import { casesService } from '@/lib/db';
import { requireAttorneyOrAdmin, errorResponse } from '@/lib/auth/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAttorneyOrAdmin(request);
    if (!auth.success) return auth.response;

    const stats = await casesService.getCaseStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching case stats:', error);
    return errorResponse('Failed to fetch case stats', 500);
  }
}
