import type { NextConfig } from "next";

/**
 * Security headers for the application.
 * These headers protect against common web vulnerabilities.
 */
const securityHeaders = [
  {
    // Strict Transport Security - enforce HTTPS
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
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
    // Content Security Policy
    // Adjust the policy based on your application's needs
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Allow inline scripts and styles for Next.js (required for development)
      // In production, consider using nonces or hashes
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // Allow images from self, data URIs, and Supabase storage
      "img-src 'self' data: blob: https://*.supabase.co",
      // Allow fonts from self and common CDNs
      "font-src 'self' data:",
      // Allow connections to self, Supabase, and AI APIs
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com",
      // Prevent framing
      "frame-ancestors 'none'",
      // Form submissions only to self
      "form-action 'self'",
      // Base URI restriction
      "base-uri 'self'",
      // Object sources
      "object-src 'none'",
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

export default nextConfig;
