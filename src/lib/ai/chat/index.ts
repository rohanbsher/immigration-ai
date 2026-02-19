'use server';

import Anthropic from '@anthropic-ai/sdk';
import { buildChatContext, getChatSystemPrefix, formatDynamicContext } from './context-builder';
import { CHAT_TOOLS, executeTool } from './tools';
import { createLogger } from '@/lib/logger';
import { getAnthropicClient, CLAUDE_MODEL } from '../client';

const log = createLogger('ai:chat');

/**
 * Chat message interface.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

/**
 * Streaming chat response generator.
 */
export async function* streamChatResponse(
  messages: ChatMessage[],
  userId: string,
  caseId?: string
): AsyncGenerator<string, void, unknown> {
  // Build context for the system prompt
  const context = await buildChatContext(userId, caseId);
  const [chatSystemPrefix, dynamicContext] = await Promise.all([
    getChatSystemPrefix(),
    formatDynamicContext(context),
  ]);

  // Build system blocks: static prefix (cached) + dynamic context (not cached)
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: 'text' as const,
      text: chatSystemPrefix,
      cache_control: { type: 'ephemeral' as const },
    },
    {
      type: 'text' as const,
      text: dynamicContext,
    },
  ];

  // Convert messages to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  // Create streaming message with tools
  const stream = await getAnthropicClient().messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemBlocks,
    messages: anthropicMessages,
    tools: CHAT_TOOLS,
  });

  // Process stream events
  let currentToolUse: { id: string; name: string; input: string } | null = null;

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      if (event.content_block.type === 'tool_use') {
        currentToolUse = {
          id: event.content_block.id,
          name: event.content_block.name,
          input: '',
        };
        yield `\n[Analyzing: ${event.content_block.name}...]\n`;
      }
    } else if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        yield event.delta.text;
      } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
        currentToolUse.input += event.delta.partial_json;
      }
    } else if (event.type === 'content_block_stop' && currentToolUse) {
      // Execute the tool
      try {
        const toolInput = JSON.parse(currentToolUse.input || '{}');
        const toolResult = await executeTool(currentToolUse.name, toolInput, userId);

        // Continue the conversation with tool result
        const toolResultMessages: Anthropic.MessageParam[] = [
          ...anthropicMessages,
          {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: currentToolUse.id,
                name: currentToolUse.name,
                input: toolInput,
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: currentToolUse.id,
                content: toolResult,
              },
            ],
          },
        ];

        // Stream the follow-up response
        const followUpStream = await getAnthropicClient().messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          system: systemBlocks,
          messages: toolResultMessages,
        });

        for await (const followUpEvent of followUpStream) {
          if (followUpEvent.type === 'content_block_delta') {
            if (followUpEvent.delta.type === 'text_delta') {
              yield followUpEvent.delta.text;
            }
          }
        }
      } catch (error) {
        log.logError('Chat tool execution failed', error instanceof Error ? error : new Error(String(error)));
        yield `\n[Tool execution failed. Please try again.]\n`;
      }

      currentToolUse = null;
    }
  }
}

/**
 * Non-streaming chat response (for simpler use cases).
 */
export async function getChatResponse(
  messages: ChatMessage[],
  userId: string,
  caseId?: string
): Promise<string> {
  let response = '';

  for await (const chunk of streamChatResponse(messages, userId, caseId)) {
    response += chunk;
  }

  return response;
}

/**
 * Generate a title for a conversation based on the first message.
 */
export async function generateConversationTitle(firstMessage: string): Promise<string> {
  try {
    const response = await getAnthropicClient().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `Generate a very brief title (3-5 words) for a conversation that starts with: "${firstMessage.slice(0, 200)}". Return only the title, no quotes or explanation.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim().slice(0, 100);
    }

    return 'New Conversation';
  } catch {
    return 'New Conversation';
  }
}
