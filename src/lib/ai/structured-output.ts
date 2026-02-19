/**
 * Structured output helper for the Anthropic API.
 *
 * Converts a Zod schema into a tool definition, forces the model to use it
 * via `tool_choice`, then extracts and validates the tool_use response.
 *
 * This eliminates the fragile parseClaudeJSON() regex-based parsing
 * and guarantees schema-conforming responses.
 */

import type { z, ZodType } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, CLAUDE_MODEL } from './client';
import { withRetry, AI_RETRY_OPTIONS } from '@/lib/utils/retry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StructuredOutputOptions<T extends ZodType> {
  /** Name for the tool -- used as the tool_use block name. */
  toolName: string;
  /** Human-readable description shown to the model. */
  toolDescription: string;
  /** Zod schema that defines the expected response shape. */
  schema: T;
  /** System prompt (string or array of content blocks). */
  system: string | Anthropic.Messages.TextBlockParam[];
  /** User message content (string for text-only, or content blocks for multimodal). */
  userMessage: string | Anthropic.Messages.ContentBlockParam[];
  /** Maximum tokens for the response (default: 4096). */
  maxTokens?: number;
  /** Whether to add cache_control to system prompt blocks (Phase 2). */
  cacheableSystem?: boolean;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Call Claude with a tool definition that guarantees structured output.
 *
 * The model is forced to respond using the tool, and the response
 * is validated against the provided Zod schema.
 */
export async function callClaudeStructured<T extends ZodType>(
  options: StructuredOutputOptions<T>
): Promise<z.infer<T>> {
  const {
    toolName,
    toolDescription,
    schema,
    system,
    userMessage,
    maxTokens = 4096,
    cacheableSystem = false,
  } = options;

  // Convert Zod schema to JSON Schema using zod v4's native method
  const jsonSchema = schema.toJSONSchema();

  // Build tool definition
  const tool: Anthropic.Messages.Tool = {
    name: toolName,
    description: toolDescription,
    input_schema: jsonSchema as Anthropic.Messages.Tool['input_schema'],
  };

  // Build system prompt -- support both string and array-of-blocks forms
  let systemParam: string | Anthropic.Messages.TextBlockParam[];
  if (typeof system === 'string') {
    if (cacheableSystem) {
      systemParam = [
        {
          type: 'text' as const,
          text: system,
          cache_control: { type: 'ephemeral' as const },
        },
      ];
    } else {
      systemParam = system;
    }
  } else {
    // Already an array of content blocks
    if (cacheableSystem) {
      systemParam = system.map((block) => ({
        ...block,
        cache_control: { type: 'ephemeral' as const },
      }));
    } else {
      systemParam = system;
    }
  }

  const message = await withRetry(
    () =>
      getAnthropicClient().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: systemParam,
        tools: [tool],
        tool_choice: { type: 'tool', name: toolName },
        messages: [{ role: 'user', content: userMessage }],
      }),
    AI_RETRY_OPTIONS
  );

  // Extract the tool_use content block
  const toolUseBlock = message.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUseBlock) {
    throw new Error(
      `Expected tool_use block for "${toolName}" but got: ${message.content.map((b) => b.type).join(', ')}`
    );
  }

  // Validate with Zod (the API guarantees schema conformance, but belt-and-suspenders)
  const parsed = schema.parse(toolUseBlock.input);
  return parsed;
}
