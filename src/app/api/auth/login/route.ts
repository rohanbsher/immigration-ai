import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authRateLimiter } from '@/lib/rate-limit';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

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

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return NextResponse.json({
      message: 'Login successful',
      user: data.user,
      session: data.session,
      profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
