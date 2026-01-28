/**
 * Shared AI utility functions for consistent behavior across AI features.
 */

/**
 * Result of an AI call with fallback tracking.
 */
export interface AIResultWithSource<T> {
  result: T;
  source: 'ai' | 'fallback';
  error?: string;
}

/**
 * Wraps an AI call with a fallback function for graceful degradation.
 *
 * @param aiCall - The async AI function to try first
 * @param fallback - The fallback function to use if AI fails
 * @returns The result with source tracking
 *
 * @example
 * const { result, source } = await withAIFallback(
 *   () => generateAIRecommendations(caseId),
 *   () => getDefaultRecommendations(caseId)
 * );
 */
export async function withAIFallback<T>(
  aiCall: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<AIResultWithSource<T>> {
  try {
    const result = await aiCall();
    return { result, source: 'ai' };
  } catch (error) {
    console.error('[AI Fallback] AI call failed, using fallback:', error);
    const fallbackResult = await fallback();
    return {
      result: fallbackResult,
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parses JSON from Claude's response, handling markdown code blocks.
 *
 * Claude often returns JSON wrapped in ```json ... ``` code blocks.
 * This function handles both raw JSON and wrapped JSON.
 *
 * @param content - The raw response content from Claude
 * @returns The parsed JSON object
 * @throws Error if JSON cannot be parsed
 *
 * @example
 * const data = parseClaudeJSON<RecommendationsResponse>(response.content);
 */
export function parseClaudeJSON<T>(content: string): T {
  if (!content || typeof content !== 'string') {
    throw new Error('Empty or invalid content');
  }

  // Try to extract JSON from markdown code block
  const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/) ||
    content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error(`Failed to parse JSON: ${jsonStr.substring(0, 100)}...`);
  }
}

/**
 * Extracts text content from a Claude message response.
 *
 * @param content - The content array from Claude's response
 * @returns The text content or empty string
 */
export function extractTextContent(
  content: Array<{ type: string; text?: string }>
): string {
  const textBlock = content.find((block) => block.type === 'text');
  return textBlock?.text || '';
}

/**
 * Calculates a weighted average score.
 *
 * @param factors - Array of { value, weight } objects
 * @returns The weighted average (0-100)
 */
export function calculateWeightedScore(
  factors: Array<{ value: number; weight: number }>
): number {
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = factors.reduce((sum, f) => sum + f.value * f.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

/**
 * Formats a document type enum value for display.
 *
 * @param docType - The document type enum value (e.g., 'birth_certificate')
 * @returns Formatted display string (e.g., 'Birth Certificate')
 */
export function formatDocumentType(docType: string): string {
  return docType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formats a visa type for display.
 *
 * @param visaType - The visa type enum value
 * @returns Formatted display string
 */
export function formatVisaType(visaType: string): string {
  // Handle special cases that are already formatted
  if (visaType.includes('-')) return visaType; // e.g., 'I-485'

  // Handle letter+number combinations
  const match = visaType.match(/^([A-Z]+)(\d+[A-Z]?)$/);
  if (match) {
    return `${match[1]}-${match[2]}`; // e.g., 'H1B' → 'H-1B'
  }

  return visaType;
}

/**
 * Maps confidence score to a severity level.
 *
 * @param confidence - Score from 0 to 1
 * @returns Severity level
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

/**
 * Maps success score to a status.
 *
 * @param score - Score from 0 to 100
 * @returns Status string for display
 */
export function getSuccessScoreStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/**
 * Truncates text to a maximum length with ellipsis.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
