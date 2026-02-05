/**
 * Mock for @/lib/config module.
 *
 * This mock provides test-friendly values that work in jsdom environment.
 * Tests that need specific environment values should use vi.mock() with
 * their own implementation.
 */

// Public environment (validated)
export const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-12345',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SITE_URL: undefined,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined,
  NEXT_PUBLIC_POSTHOG_KEY: undefined,
  NEXT_PUBLIC_POSTHOG_HOST: undefined,
};

// Server environment (computed from process.env for testing)
// Falls back to test values only when env vars are not set
export const serverEnv = {
  get NODE_ENV() { return (process.env.NODE_ENV || 'test') as 'development' | 'production' | 'test'; },
  get OPENAI_API_KEY() { return process.env.OPENAI_API_KEY; },
  get ANTHROPIC_API_KEY() { return process.env.ANTHROPIC_API_KEY; },
  get ENCRYPTION_KEY() { return process.env.ENCRYPTION_KEY || '0'.repeat(64); },
  get STRIPE_SECRET_KEY() { return process.env.STRIPE_SECRET_KEY; },
  get STRIPE_WEBHOOK_SECRET() { return process.env.STRIPE_WEBHOOK_SECRET; },
  get STRIPE_PRICE_PRO_MONTHLY() { return process.env.STRIPE_PRICE_PRO_MONTHLY; },
  get STRIPE_PRICE_PRO_YEARLY() { return process.env.STRIPE_PRICE_PRO_YEARLY; },
  get STRIPE_PRICE_ENTERPRISE_MONTHLY() { return process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY; },
  get STRIPE_PRICE_ENTERPRISE_YEARLY() { return process.env.STRIPE_PRICE_ENTERPRISE_YEARLY; },
  get RESEND_API_KEY() { return process.env.RESEND_API_KEY; },
  get EMAIL_FROM() { return process.env.EMAIL_FROM; },
  get EMAIL_REPLY_TO() { return process.env.EMAIL_REPLY_TO; },
  get UPSTASH_REDIS_REST_URL() { return process.env.UPSTASH_REDIS_REST_URL; },
  get UPSTASH_REDIS_REST_TOKEN() { return process.env.UPSTASH_REDIS_REST_TOKEN; },
  get CRON_SECRET() { return process.env.CRON_SECRET; },
  get VIRUS_SCANNER_PROVIDER() { return process.env.VIRUS_SCANNER_PROVIDER as 'clamav' | 'virustotal' | 'mock' | undefined; },
  get CLAMAV_API_URL() { return process.env.CLAMAV_API_URL; },
  get VIRUSTOTAL_API_KEY() { return process.env.VIRUSTOTAL_API_KEY; },
  get VERCEL_URL() { return process.env.VERCEL_URL; },
};

// Feature flags (computed dynamically from process.env for testing)
// This allows tests to override NODE_ENV and see updated feature flags
export const features = {
  get documentAnalysis() { return !!process.env.OPENAI_API_KEY; },
  get formAutofill() { return !!process.env.ANTHROPIC_API_KEY; },
  get billing() {
    return !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && !!process.env.STRIPE_SECRET_KEY;
  },
  get email() { return !!process.env.RESEND_API_KEY; },
  get redisRateLimiting() {
    return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
  },
  get analytics() { return !!process.env.NEXT_PUBLIC_POSTHOG_KEY; },
  get encryption() { return !!process.env.ENCRYPTION_KEY; },
  get cronJobs() { return !!process.env.CRON_SECRET; },
  get virusScanning() {
    return !!process.env.VIRUS_SCANNER_PROVIDER && process.env.VIRUS_SCANNER_PROVIDER !== 'mock';
  },
  get isDevelopment() { return process.env.NODE_ENV === 'development'; },
  get isProduction() { return process.env.NODE_ENV === 'production'; },
};

// Type exports
export type PublicEnv = typeof env;
export type ServerEnv = typeof serverEnv;
