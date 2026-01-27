import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Sanitize search input for use in Supabase ILIKE patterns.
 * Escapes special characters and limits length to prevent injection and DoS.
 */
function sanitizeSearchInput(input: string): string {
  // Limit length to prevent DoS
  const truncated = input.slice(0, 100);

  // Escape SQL LIKE wildcards (% and _) so they're treated as literals
  // Remove PostgREST filter special characters that could manipulate the query
  const sanitized = truncated
    .replace(/[%_]/g, '\\$&') // Escape SQL LIKE wildcards
    .replace(/[,.'"\(\)]/g, '') // Remove PostgREST special chars
    .trim();

  return sanitized;
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const { data: profile } = await serverAuth.getProfile();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawSearch = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || '20')), 100); // Cap at 100

    const supabase = await createClient();

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    if (rawSearch) {
      // Sanitize search input to prevent filter injection
      const search = sanitizeSearchInput(rawSearch);
      if (search.length > 0) {
        query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      }
    }

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    const mappedUsers = (users || []).map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      createdAt: user.created_at,
      lastSignIn: user.updated_at,
      suspended: false,
    }));

    return NextResponse.json({
      success: true,
      data: {
        users: mappedUsers,
        total: count || 0,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
