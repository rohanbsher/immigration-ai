import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Config/Env Module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-12345',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NODE_ENV: 'test',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  describe('public environment variables (env)', () => {
    it('should export validated public environment', async () => {
      const { env } = await import('./env');

      expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co');
      expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-anon-key-12345');
      expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    });

    it('should have default value for NEXT_PUBLIC_APP_URL', async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      vi.resetModules();

      const { env } = await import('./env');

      expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    });

    it('should throw error for missing required Supabase URL', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      vi.resetModules();

      await expect(import('./env')).rejects.toThrow(
        'Invalid public environment configuration'
      );
    });

    it('should throw error for missing required Supabase anon key', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      vi.resetModules();

      await expect(import('./env')).rejects.toThrow(
        'Invalid public environment configuration'
      );
    });

    it('should throw error for invalid Supabase URL format', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-valid-url';
      vi.resetModules();

      await expect(import('./env')).rejects.toThrow(
        'Invalid public environment configuration'
      );
    });

    it('should allow optional Stripe publishable key', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_12345';
      vi.resetModules();

      const { env } = await import('./env');

      expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBe('pk_test_12345');
    });

    it('should allow missing optional keys', async () => {
      vi.resetModules();

      const { env } = await import('./env');

      expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBeUndefined();
      expect(env.NEXT_PUBLIC_POSTHOG_KEY).toBeUndefined();
      expect(env.NEXT_PUBLIC_POSTHOG_HOST).toBeUndefined();
      expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
    });

    it('should validate NEXT_PUBLIC_POSTHOG_HOST as URL', async () => {
      process.env.NEXT_PUBLIC_POSTHOG_HOST = 'not-a-url';
      vi.resetModules();

      await expect(import('./env')).rejects.toThrow();
    });

    it('should accept valid PostHog configuration', async () => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test123';
      process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://app.posthog.com';
      vi.resetModules();

      const { env } = await import('./env');

      expect(env.NEXT_PUBLIC_POSTHOG_KEY).toBe('phc_test123');
      expect(env.NEXT_PUBLIC_POSTHOG_HOST).toBe('https://app.posthog.com');
    });
  });

  describe('serverEnv (client-side behavior)', () => {
    it('should throw when accessing serverEnv from client', async () => {
      const { serverEnv } = await import('./env');

      expect(() => serverEnv.NODE_ENV).toThrow(
        'Server environment variables are only available in Server Components and API routes'
      );
    });

    it('should throw with property name in error message', async () => {
      const { serverEnv } = await import('./env');

      expect(() => serverEnv.OPENAI_API_KEY).toThrow('OPENAI_API_KEY');
    });
  });

  describe('feature flags', () => {
    it('should detect document analysis capability', async () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.documentAnalysis).toBe(true);
    });

    it('should detect missing document analysis', async () => {
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.documentAnalysis).toBe(false);
    });

    it('should detect form autofill capability', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.formAutofill).toBe(true);
    });

    it('should detect missing form autofill', async () => {
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.formAutofill).toBe(false);
    });

    it('should detect billing capability when both keys present', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test';
      process.env.STRIPE_SECRET_KEY = 'sk_test';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.billing).toBe(true);
    });

    it('should detect missing billing when publishable key missing', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.billing).toBe(false);
    });

    it('should detect missing billing when secret key missing', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.billing).toBe(false);
    });

    it('should detect email capability', async () => {
      process.env.RESEND_API_KEY = 're_test';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.email).toBe(true);
    });

    it('should detect missing email capability', async () => {
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.email).toBe(false);
    });

    it('should detect Redis rate limiting capability', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.redisRateLimiting).toBe(true);
    });

    it('should detect missing Redis when URL missing', async () => {
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.redisRateLimiting).toBe(false);
    });

    it('should detect analytics capability', async () => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.analytics).toBe(true);
    });

    it('should detect missing analytics', async () => {
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.analytics).toBe(false);
    });

    it('should detect encryption capability', async () => {
      process.env.ENCRYPTION_KEY = '0'.repeat(64);
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.encryption).toBe(true);
    });

    it('should detect missing encryption', async () => {
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.encryption).toBe(false);
    });

    it('should detect development mode', async () => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.isDevelopment).toBe(true);
      expect(features.isProduction).toBe(false);
    });

    it('should detect production mode', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.isDevelopment).toBe(false);
      expect(features.isProduction).toBe(true);
    });

    it('should detect test mode as neither development nor production', async () => {
      process.env.NODE_ENV = 'test';
      vi.resetModules();

      const { features } = await import('./env');

      expect(features.isDevelopment).toBe(false);
      expect(features.isProduction).toBe(false);
    });
  });

  describe('type exports', () => {
    it('should export PublicEnv and ServerEnv types', async () => {
      const module = await import('./env');

      expect(module).toHaveProperty('env');
      expect(module).toHaveProperty('serverEnv');
      expect(module).toHaveProperty('features');
    });
  });
});

describe('Config Index Module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-12345',
      NODE_ENV: 'test',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('should re-export env from env.ts', async () => {
    const { env } = await import('./index');

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co');
  });

  it('should re-export serverEnv from env.ts', async () => {
    const { serverEnv } = await import('./index');

    expect(serverEnv).toBeDefined();
  });

  it('should re-export features from env.ts', async () => {
    const { features } = await import('./index');

    expect(features).toHaveProperty('isDevelopment');
    expect(features).toHaveProperty('isProduction');
  });
});
