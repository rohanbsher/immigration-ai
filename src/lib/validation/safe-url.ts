import { z } from 'zod';

/**
 * Dangerous URL protocols that can lead to XSS when rendered
 * in <img src>, <a href>, or similar HTML attributes.
 *
 * Zod's built-in `.url()` accepts these, so we add a refinement.
 */
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'blob:'] as const;

/**
 * Check whether a URL uses only safe protocols (http/https).
 */
export function isSafeUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return !DANGEROUS_PROTOCOLS.some((proto) => lower.startsWith(proto));
}

/**
 * A Zod schema for URLs that rejects dangerous protocols.
 * Use this instead of `z.string().url()` for any user-provided URL
 * that will be rendered in HTML (avatar_url, logoUrl, website, etc.).
 */
export const safeUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(isSafeUrl, 'URL must use https: or http: protocol');
