import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authRateLimiter } from '@/lib/rate-limit';
import { sendWelcomeEmail } from '@/lib/email/notifications';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:auth-register');

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['attorney', 'client']),
  barNumber: z.string().optional(),
  firmName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 requests per minute per IP (prevent mass account creation)
    const rateLimitResult = await authRateLimiter.limit(request);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Validate attorney-specific fields
    if (validatedData.role === 'attorney' && !validatedData.barNumber) {
      return NextResponse.json(
        { error: 'Bar number is required for attorneys' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Attempt signup - the handle_new_user trigger should create the profile.
    // If the trigger fails, signUp returns a "Database error saving new user" error.
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          first_name: validatedData.firstName,
          last_name: validatedData.lastName,
          role: validatedData.role,
          bar_number: validatedData.barNumber,
          firm_name: validatedData.firmName,
        },
      },
    });

    if (error) {
      log.logError('Supabase signUp failed', {
        message: error.message,
        code: error.code,
        status: error.status,
      });
      return NextResponse.json(
        { error: 'Registration could not be completed. Please try again.' },
        { status: 400 }
      );
    }

    // Send welcome email (fire and forget - don't block registration)
    if (data.user) {
      sendWelcomeEmail(
        data.user.id,
        validatedData.email,
        validatedData.firstName
      ).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        log.logError('Failed to send welcome email', { error: message });
      });
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      return NextResponse.json({
        message: 'Please check your email to confirm your account',
        requiresConfirmation: true,
      });
    }

    return NextResponse.json({
      message: 'Account created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map(i => i.message).join('; ') },
        { status: 400 }
      );
    }

    log.logError('Registration error', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
