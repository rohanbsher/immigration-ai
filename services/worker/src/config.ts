import 'dotenv/config';
import { z } from 'zod';

const workerConfigSchema = z.object({
  // Required
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Optional AI keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Optional service keys
  RESEND_API_KEY: z.string().optional(),
  PDF_SERVICE_URL: z.string().url().optional(),
  PDF_SERVICE_SECRET: z.string().optional(),

  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // Security
  BULL_BOARD_PASSWORD: z.string().optional(),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Observability
  SENTRY_DSN: z.string().url().optional(),
});

export type WorkerConfig = z.infer<typeof workerConfigSchema>;

function validateConfig(): WorkerConfig {
  const result = workerConfigSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error('Worker configuration validation failed:\n' + errors);
    process.exit(1);
  }

  const config = result.data;

  // Warn if Bull Board is unprotected in production
  if (config.NODE_ENV === 'production' && !config.BULL_BOARD_PASSWORD) {
    console.warn(
      'WARNING: BULL_BOARD_PASSWORD is not set. ' +
      'The Bull Board dashboard will be unprotected in production.'
    );
  }

  return config;
}

export const workerConfig = validateConfig();
