/**
 * Environment variable validation and type-safe configuration.
 *
 * This module uses Zod to validate all environment variables at startup
 * and provides a centralized, type-safe way to access configuration.
 *
 * Usage:
 *   import { env, serverEnv, features } from '@/lib/config/env';
 *
 *   // Public vars (available in client and server)
 *   const url = env.NEXT_PUBLIC_SUPABASE_URL;
 *
 *   // Server-only vars (only available in server components/API routes)
 *   const apiKey = serverEnv.OPENAI_API_KEY;
 *
 *   // Feature flags
 *   if (features.billing) { ... }
 */

import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('config');

// =============================================================================
// Schema Definitions
// =============================================================================

/**
 * Public environment variables (exposed to the client via NEXT_PUBLIC_ prefix)
 */
const publicEnvSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),

  // App Configuration
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('Invalid app URL')
    .default('http://localhost:3000'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // Stripe (client-side)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Analytics (optional)
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),

  // Error tracking (optional)
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

/**
 * Server-only environment variables (never exposed to client)
 */
const serverEnvSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Supabase service role (admin access, never expose to client)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required').optional(),

  // AI Configuration
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Security - Required for production, optional in development
  ENCRYPTION_KEY: z
    .string()
    .length(
      64,
      'ENCRYPTION_KEY must be a 64-character hex string. Generate with: openssl rand -hex 32'
    )
    .optional(),

  // Stripe (server-side)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE_YEARLY: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.string().min(1).optional(),

  // Rate Limiting (optional - falls back to in-memory)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Cron Jobs
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters').optional(),

  // Virus Scanner Configuration
  VIRUS_SCANNER_PROVIDER: z.enum(['clamav', 'virustotal', 'mock']).optional(),
  CLAMAV_API_URL: z.string().url().optional(),
  VIRUSTOTAL_API_KEY: z.string().optional(),

  // Vercel (auto-set)
  VERCEL_URL: z.string().optional(),
});

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Format Zod errors into readable messages
 */
function formatErrors(errors: z.ZodError): string {
  return errors.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
}

/**
 * Validate public environment variables
 */
function validatePublicEnv() {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  if (!result.success) {
    log.error(
      'Invalid public environment variables:\n' +
        formatErrors(result.error)
    );
    throw new Error('Invalid public environment configuration');
  }

  return result.data;
}

/**
 * Validate server environment variables
 */
function validateServerEnv() {
  // Skip validation on client
  if (typeof window !== 'undefined') {
    return null;
  }

  const result = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY,
    STRIPE_PRICE_ENTERPRISE_MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    STRIPE_PRICE_ENTERPRISE_YEARLY: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    VIRUS_SCANNER_PROVIDER: process.env.VIRUS_SCANNER_PROVIDER,
    CLAMAV_API_URL: process.env.CLAMAV_API_URL,
    VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY,
    VERCEL_URL: process.env.VERCEL_URL,
  });

  if (!result.success) {
    log.error(
      'Invalid server environment variables:\n' +
        formatErrors(result.error)
    );
    throw new Error('Invalid server environment configuration');
  }

  // Production-specific validation
  if (process.env.NODE_ENV === 'production') {
    validateProductionRequirements(result.data);
  }

  return result.data;
}

/**
 * Validate production-specific requirements
 * These are critical for production but optional in development
 */
function validateProductionRequirements(env: z.infer<typeof serverEnvSchema>) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical: Required for core functionality
  if (!env.ENCRYPTION_KEY) {
    errors.push('ENCRYPTION_KEY is required in production for PII protection');
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required in production for admin database operations');
  }

  // Critical: At least one AI service should be configured
  if (!env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY) {
    errors.push('At least one AI API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) is required');
  }

  // Warning: Billing not configured
  if (!env.STRIPE_SECRET_KEY) {
    warnings.push('STRIPE_SECRET_KEY not set - billing features will be disabled');
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    warnings.push('STRIPE_WEBHOOK_SECRET not set - Stripe webhooks will fail');
  }

  // Warning: Email not configured
  if (!env.RESEND_API_KEY) {
    warnings.push('RESEND_API_KEY not set - email notifications will be disabled');
  }

  // Warning: Rate limiting fallback
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    warnings.push('Upstash Redis not configured - using in-memory rate limiting (not suitable for multiple instances)');
  }

  // Critical: Cron jobs require authentication
  if (!env.CRON_SECRET) {
    errors.push('CRON_SECRET is required in production for scheduled task authentication');
  }

  // Warning: Error tracking not configured
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    warnings.push('SENTRY_DSN not configured - error tracking and monitoring will be disabled in production');
  }

  // Warning: Virus scanner not configured
  if (!env.VIRUS_SCANNER_PROVIDER || env.VIRUS_SCANNER_PROVIDER === 'mock') {
    warnings.push('VIRUS_SCANNER_PROVIDER not configured - uploads use heuristic checks only');
  } else if (env.VIRUS_SCANNER_PROVIDER === 'clamav' && !env.CLAMAV_API_URL) {
    errors.push('CLAMAV_API_URL is required when using ClamAV virus scanner');
  } else if (env.VIRUS_SCANNER_PROVIDER === 'virustotal' && !env.VIRUSTOTAL_API_KEY) {
    errors.push('VIRUSTOTAL_API_KEY is required when using VirusTotal virus scanner');
  }

  // Log warnings
  if (warnings.length > 0) {
    log.warn(
      'Production warnings:\n' +
        warnings.map((w) => `  - ${w}`).join('\n')
    );
  }

  // Throw on critical errors
  if (errors.length > 0) {
    log.error(
      'Production requirements not met:\n' +
        errors.map((e) => `  - ${e}`).join('\n')
    );
    throw new Error(
      `Production environment misconfigured: ${errors.length} critical issue(s) found. See logs for details.`
    );
  }
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Public environment variables - safe to use in client components
 */
export const env = validatePublicEnv();

/**
 * Server-only environment variables - throws if accessed on client
 */
export const serverEnv = (() => {
  const validated = validateServerEnv();

  // Return a proxy that throws on client access
  if (!validated) {
    return new Proxy({} as NonNullable<ReturnType<typeof validateServerEnv>>, {
      get(_, prop) {
        throw new Error(
          `Attempted to access server environment variable "${String(prop)}" on the client. ` +
            'Server environment variables are only available in Server Components and API routes.'
        );
      },
    });
  }

  return validated;
})();

// Type exports for use elsewhere
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

// =============================================================================
// Feature Flags (derived from env)
// =============================================================================

/**
 * Feature availability flags based on environment configuration
 */
export const features = {
  /** Whether AI document analysis is configured (OpenAI) */
  documentAnalysis: !!process.env.OPENAI_API_KEY,

  /** Whether AI form autofill is configured (Anthropic) */
  formAutofill: !!process.env.ANTHROPIC_API_KEY,

  /** Whether Stripe billing is configured */
  billing:
    !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    !!process.env.STRIPE_SECRET_KEY,

  /** Whether email sending is configured */
  email: !!process.env.RESEND_API_KEY,

  /** Whether Redis rate limiting is configured (vs in-memory fallback) */
  redisRateLimiting:
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN,

  /** Whether analytics is configured */
  analytics: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,

  /** Whether encryption is configured for PII */
  encryption: !!process.env.ENCRYPTION_KEY,

  /** Whether cron jobs are properly configured */
  cronJobs: !!process.env.CRON_SECRET,

  /** Whether virus scanning is properly configured (not mock) */
  virusScanning:
    !!process.env.VIRUS_SCANNER_PROVIDER &&
    process.env.VIRUS_SCANNER_PROVIDER !== 'mock',

  /** Whether running in development mode */
  isDevelopment: process.env.NODE_ENV === 'development',

  /** Whether running in production mode */
  isProduction: process.env.NODE_ENV === 'production',
} as const;
