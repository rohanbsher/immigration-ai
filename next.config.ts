import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Security headers for the application.
 * These headers protect against common web vulnerabilities.
 */
const securityHeaders = [
  // HSTS only in production (prevents localhost HTTPS enforcement in dev)
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
  {
    // Enable DNS prefetching for performance
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    // Prevent MIME type sniffing
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Prevent clickjacking
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // XSS protection (legacy, but still useful for older browsers)
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    // Control referrer information
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Permissions Policy - disable unnecessary browser features
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Cross-Origin isolation headers
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    // CORP controls whether OTHER origins can embed OUR responses.
    // same-origin prevents external sites from embedding our resources.
    // This does NOT affect loading cross-origin resources (e.g., Supabase
    // storage URLs) — those have their own CORP headers.
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    // Content Security Policy
    // Note: unsafe-inline is required for Next.js hydration scripts and Tailwind CSS.
    // For stricter CSP, implement nonce-based CSP via middleware.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Allow inline scripts for Next.js hydration
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // Allow images from self, data URIs, and Supabase storage
      "img-src 'self' data: blob: https://*.supabase.co",
      // Allow fonts from self and common CDNs
      "font-src 'self' data:",
      // Allow connections to self, Supabase, AI APIs, Sentry, and Stripe
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://*.sentry.io https://*.ingest.sentry.io https://api.stripe.com https://js.stripe.com",
      // Prevent framing
      "frame-ancestors 'none'",
      // Stripe iframe for checkout
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      // Form submissions only to self
      "form-action 'self'",
      // Base URI restriction
      "base-uri 'self'",
      // Object sources
      "object-src 'none'",
      // Worker sources
      "worker-src 'self' blob:",
      // Upgrade insecure requests in production only (breaks localhost in dev)
      ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Security headers for all routes
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Additional headers for API routes
        source: "/api/:path*",
        headers: [
          // Prevent caching of sensitive API responses
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },

  // Disable x-powered-by header
  poweredByHeader: false,

  // Enable strict mode for React
  reactStrictMode: true,

  // Configure allowed image domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,

  // Organization and project for Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps in production only
  hideSourceMaps: process.env.NODE_ENV === "production",

  // Disable Sentry telemetry
  telemetry: false,
};

// Wrap with Sentry only if DSN is configured
const exportedConfig = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;

export default exportedConfig;
