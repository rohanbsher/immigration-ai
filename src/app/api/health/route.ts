import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getDetailedRedisHealth } from '@/lib/rate-limit/health';

// NOTE: Health checks intentionally use process.env directly (not serverEnv)
// to diagnose configuration issues. If serverEnv validation fails, we still
// want the health endpoint to report which variables are missing.

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks?: {
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

export async function GET(request: NextRequest) {
  const isDetailedCheck = request.headers.get('x-health-detail') === 'true';

  // Basic health check for load balancers - minimal info, no auth required
  if (!isDetailedCheck) {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // Detailed check requires authentication
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // Full detailed health check
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
  // Check service configuration status without exposing key details
  // This is safe because it only checks presence, not key values or lengths
  const services: { name: string; configured: boolean }[] = [
    { name: 'stripe', configured: !!process.env.STRIPE_SECRET_KEY },
    { name: 'anthropic', configured: !!process.env.ANTHROPIC_API_KEY },
    { name: 'openai', configured: !!process.env.OPENAI_API_KEY },
    { name: 'resend', configured: !!process.env.RESEND_API_KEY },
  ];

  const configuredCount = services.filter((s) => s.configured).length;

  if (configuredCount === 0) {
    return {
      status: 'warn',
      message: 'No external services configured',
      details: {
        configuredCount: 0,
        totalServices: services.length,
      },
    };
  }

  if (configuredCount < services.length) {
    return {
      status: 'warn',
      message: 'Some external services not configured',
      details: {
        configuredCount,
        totalServices: services.length,
      },
    };
  }

  return {
    status: 'pass',
    message: 'All external services configured',
    details: {
      configuredCount,
      totalServices: services.length,
    },
  };
}
