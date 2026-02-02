import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:auth-login');

const LOGIN_TIMEOUT_MS = 15_000;

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

class LoginTimeoutError extends Error {
  constructor() {
    super('Login request timed out');
    this.name = 'LoginTimeoutError';
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 requests per minute per IP (brute force protection)
    const rateLimitResult = await authRateLimiter.limit(request);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    const supabase = await createClient();

    // Wrap signInWithPassword with timeout
    const signInResult = await Promise.race([
      supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new LoginTimeoutError()), LOGIN_TIMEOUT_MS)
      ),
    ]);

    const { data, error } = signInResult;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    // Explicitly get the session to ensure cookies are set
    const { data: sessionData } = await supabase.auth.getSession();

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return NextResponse.json({
      message: 'Login successful',
      user: data.user,
      session: sessionData.session ?? data.session,
      profile,
    });
  } catch (error) {
    if (error instanceof LoginTimeoutError) {
      log.error('Login timeout - Supabase auth took too long');
      return NextResponse.json(
        { error: 'Login timed out. Please try again.' },
        { status: 504 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    log.logError('Login error', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
