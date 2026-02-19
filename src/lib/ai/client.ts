/**
 * Consolidated Anthropic client singleton.
 *
 * All modules that need an Anthropic client should import from here
 * instead of creating their own instances.
 */

import Anthropic from '@anthropic-ai/sdk';
import { serverEnv, features } from '@/lib/config';

/** Model constant -- single place to upgrade across the entire codebase. */
export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

let anthropicInstance: Anthropic | null = null;

/**
 * Get the shared Anthropic client instance.
 * Lazy-initialized to avoid errors during build when API key is unset.
 */
export function getAnthropicClient(): Anthropic {
  if (!anthropicInstance) {
    if (!features.formAutofill) {
      throw new Error('Anthropic API is not configured (ANTHROPIC_API_KEY not set)');
    }
    anthropicInstance = new Anthropic({
      apiKey: serverEnv.ANTHROPIC_API_KEY,
      timeout: 120_000, // 120s -- matches TIMEOUT_CONFIG.AI
    });
  }
  return anthropicInstance;
}
