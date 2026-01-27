import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    environment: HealthCheck;
    redis: HealthCheck;
    externalServices: HealthCheck;
  };
}

interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

// Track server start time for uptime calculation
const serverStartTime = Date.now();

export async function GET() {
  const startTime = Date.now();

  const checks = {
    database: await checkDatabase(),
    environment: checkEnvironment(),
    redis: await checkRedis(),
    externalServices: checkExternalServices(),
  };

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (statuses.includes('fail')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('warn')) {
    overallStatus = 'degraded';
  }

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    checks,
  };

  // Set appropriate status code
  const statusCode =
    overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(result, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check-Duration': `${Date.now() - startTime}ms`,
    },
  });
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    // Use service role to bypass RLS for health check
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Simple query to verify connectivity
    const { error } = await supabase.from('profiles').select('id').limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: 'fail',
        message: 'Database query failed',
        responseTime,
        details: { error: error.message },
      };
    }

    // Warn if response time is slow (> 1 second)
    if (responseTime > 1000) {
      return {
        status: 'warn',
        message: 'Database responding slowly',
        responseTime,
      };
    }

    return {
      status: 'pass',
      message: 'Database connection healthy',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Database connection failed',
      responseTime: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

function checkEnvironment(): HealthCheck {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const optionalEnvVars = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'STRIPE_SECRET_KEY',
    'RESEND_API_KEY',
  ];

  const missingRequired = requiredEnvVars.filter((key) => !process.env[key]);
  const missingOptional = optionalEnvVars.filter((key) => !process.env[key]);

  if (missingRequired.length > 0) {
    return {
      status: 'fail',
      message: 'Required environment variables missing',
      details: { missing: missingRequired },
    };
  }

  if (missingOptional.length > 0) {
    return {
      status: 'warn',
      message: 'Optional environment variables not configured',
      details: {
        missing: missingOptional,
        note: 'Some features may be unavailable',
      },
    };
  }

  return {
    status: 'pass',
    message: 'All environment variables configured',
  };
}

async function checkRedis(): Promise<HealthCheck> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Redis is optional - if not configured, that's okay
  if (!redisUrl || !redisToken) {
    return {
      status: 'warn',
      message: 'Redis not configured (using in-memory rate limiting)',
      details: {
        note: 'Rate limiting will not persist across server restarts or scale correctly with multiple instances',
      },
    };
  }

  const startTime = Date.now();

  try {
    // Simple ping to verify Redis connectivity
    const response = await fetch(`${redisUrl}/ping`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: 'fail',
        message: 'Redis connection failed',
        responseTime,
        details: { statusCode: response.status },
      };
    }

    if (responseTime > 500) {
      return {
        status: 'warn',
        message: 'Redis responding slowly',
        responseTime,
      };
    }

    return {
      status: 'pass',
      message: 'Redis connection healthy',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Redis connection failed',
      responseTime: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.message : 'Connection timeout or error',
      },
    };
  }
}

function checkExternalServices(): HealthCheck {
  const services: { name: string; status: 'pass' | 'warn' | 'fail' }[] = [];

  // Check Stripe if configured
  if (process.env.STRIPE_SECRET_KEY) {
    const isValidKey = process.env.STRIPE_SECRET_KEY.startsWith('sk_');
    services.push({
      name: 'stripe',
      status: isValidKey ? 'pass' : 'warn',
    });
  }

  // Check AI services
  if (process.env.ANTHROPIC_API_KEY) {
    services.push({
      name: 'anthropic',
      status: process.env.ANTHROPIC_API_KEY.length > 0 ? 'pass' : 'warn',
    });
  }

  if (process.env.OPENAI_API_KEY) {
    services.push({
      name: 'openai',
      status: process.env.OPENAI_API_KEY.length > 0 ? 'pass' : 'warn',
    });
  }

  // Check email service
  if (process.env.RESEND_API_KEY) {
    services.push({
      name: 'resend',
      status: process.env.RESEND_API_KEY.startsWith('re_') ? 'pass' : 'warn',
    });
  }

  // Note: Redis is checked separately via checkRedis()

  const failedServices = services.filter((s) => s.status === 'fail');
  const warnServices = services.filter((s) => s.status === 'warn');

  if (failedServices.length > 0) {
    return {
      status: 'fail',
      message: 'External services unavailable',
      details: {
        services: services.map((s) => ({ name: s.name, status: s.status })),
      },
    };
  }

  if (warnServices.length > 0 || services.length === 0) {
    return {
      status: 'warn',
      message:
        services.length === 0
          ? 'No external services configured'
          : 'Some services need attention',
      details: {
        services: services.map((s) => ({ name: s.name, status: s.status })),
      },
    };
  }

  return {
    status: 'pass',
    message: 'All external services operational',
    details: {
      services: services.map((s) => ({ name: s.name, status: s.status })),
    },
  };
}
