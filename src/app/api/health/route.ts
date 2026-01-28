import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getDetailedRedisHealth } from '@/lib/rate-limit/health';

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
  recommendations?: string[];
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
  const startTime = Date.now();

  try {
    const detailedHealth = await getDetailedRedisHealth();
    const responseTime = Date.now() - startTime;

    // Map detailed status to health check status
    const statusMap: Record<string, 'pass' | 'warn' | 'fail'> = {
      healthy: 'pass',
      degraded: 'warn',
      unhealthy: 'fail',
    };

    return {
      status: statusMap[detailedHealth.status],
      message: detailedHealth.metrics.connected
        ? `Redis connection healthy (${detailedHealth.metrics.provider})`
        : detailedHealth.metrics.error || 'Redis not available',
      responseTime: detailedHealth.metrics.latency || responseTime,
      details: {
        provider: detailedHealth.metrics.provider,
        configured: detailedHealth.rateLimitInfo.configured,
        keyCount: detailedHealth.rateLimitInfo.totalKeys,
      },
      recommendations: detailedHealth.recommendations.length > 0
        ? detailedHealth.recommendations
        : undefined,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Redis health check failed',
      responseTime: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
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
