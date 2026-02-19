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
import { anthropicBreaker } from './circuit-breaker';
import { createLogger } from '@/lib/logger';

const log = createLogger('ai:structured-output');

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
  } = options;

  // Convert Zod schema to JSON Schema using zod v4's native method
  const jsonSchema = schema.toJSONSchema();

  // Build tool definition
  const tool: Anthropic.Messages.Tool = {
    name: toolName,
    description: toolDescription,
    input_schema: jsonSchema as Anthropic.Messages.Tool['input_schema'],
  };

  const message = await anthropicBreaker.execute(() =>
    withRetry(
      () =>
        getAnthropicClient().messages.create({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          system,
          tools: [tool],
          tool_choice: { type: 'tool', name: toolName },
          messages: [{ role: 'user', content: userMessage }],
        }),
      AI_RETRY_OPTIONS
    )
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
  try {
    const parsed = schema.parse(toolUseBlock.input);
    return parsed;
  } catch (zodError) {
    log.error('Structured output failed Zod validation', {
      toolName,
      error: zodError instanceof Error ? zodError.message : String(zodError),
      rawInput: JSON.stringify(toolUseBlock.input).slice(0, 500),
    });
    throw zodError;
  }
}
