import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { sanitizeSearchInput } from '@/lib/db/base-service';

const log = createLogger('api:admin-users');

export async function GET(request: NextRequest) {
  try {
    // Authenticate FIRST, then rate-limit on user ID.
    // Rate-limiting on IP before auth allows attackers to DoS the limiter
    // with spoofed X-Forwarded-For headers.
    const profile = await serverAuth.getProfile();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, profile.id);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
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
      log.logError('Database query failed', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    const adminClient = getAdminClient();
    const userIds = (users || []).map((u) => u.id);

    // Batch ban status checks in parallel to avoid N+1 sequential queries
    const bannedUserIds = new Set<string>();
    const banCheckResults = await Promise.allSettled(
      userIds.map(async (uid) => {
        const { data: authUser } = await adminClient.auth.admin.getUserById(uid);
        if (authUser?.user?.banned_until) {
          const bannedUntil = new Date(authUser.user.banned_until);
          if (bannedUntil > new Date()) {
            return uid;
          }
        }
        return null;
      })
    );
    for (const result of banCheckResults) {
      if (result.status === 'fulfilled' && result.value) {
        bannedUserIds.add(result.value);
      }
    }

    const mappedUsers = (users || []).map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      createdAt: user.created_at,
      lastSignIn: user.updated_at,
      suspended: bannedUserIds.has(user.id),
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
    log.logError('Admin users error', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
