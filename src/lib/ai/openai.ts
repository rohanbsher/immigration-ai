// OpenAI client for document OCR using GPT-4 Vision

import OpenAI from 'openai';
import { DocumentAnalysisResult, AnalysisOptions } from './types';
import {
  DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
  getExtractionPrompt,
} from './prompts';

// Lazy-initialize OpenAI client to avoid errors during build
let openaiInstance: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

export interface VisionAnalysisInput {
  imageUrl?: string;
  imageBase64?: string;
  documentType?: string;
  options?: AnalysisOptions;
}

/**
 * Analyze a document image using GPT-4 Vision
 */
export async function analyzeDocumentWithVision(
  input: VisionAnalysisInput
): Promise<DocumentAnalysisResult> {
  const startTime = Date.now();

  if (!input.imageUrl && !input.imageBase64) {
    throw new Error('Either imageUrl or imageBase64 must be provided');
  }

  // Build the image content based on input type
  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPartImage =
    input.imageUrl
      ? {
          type: 'image_url',
          image_url: {
            url: input.imageUrl,
            detail: input.options?.high_accuracy_mode ? 'high' : 'auto',
          },
        }
      : {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${input.imageBase64}`,
            detail: input.options?.high_accuracy_mode ? 'high' : 'auto',
          },
        };

  // Get the appropriate extraction prompt
  const extractionPrompt = getExtractionPrompt(
    input.documentType || input.options?.document_type || 'generic'
  );

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: extractionPrompt,
            },
            imageContent,
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1, // Low temperature for more consistent extractions
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content) as DocumentAnalysisResult;

    return {
      ...parsed,
      processing_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        throw new Error('Invalid OpenAI API key');
      }
      if (error.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      }
      if (error.status === 400) {
        throw new Error(
          'Invalid image format or size. Please ensure the image is a valid JPEG, PNG, GIF, or WebP under 20MB.'
        );
      }
    }

    throw error;
  }
}

/**
 * Extract text from a document image (OCR only, no structured extraction)
 */
export async function extractTextFromImage(
  imageUrl: string
): Promise<{ text: string; confidence: number }> {
  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all text from this document image. Return the text exactly as it appears, preserving line breaks and formatting where possible. Only return the extracted text, nothing else.',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0,
  });

  const text = response.choices[0]?.message?.content || '';

  return {
    text,
    confidence: text.length > 0 ? 0.9 : 0,
  };
}

/**
 * Detect the type of a document from an image
 */
export async function detectDocumentType(
  imageUrl: string
): Promise<{ type: string; confidence: number }> {
  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Identify the type of document in this image. Common types include:
- passport
- birth_certificate
- marriage_certificate
- divorce_certificate
- employment_letter
- bank_statement
- tax_return
- utility_bill
- drivers_license
- national_id
- visa
- i94
- green_card
- naturalization_certificate
- other

Respond with JSON: { "type": "document_type", "confidence": 0.95 }`,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'low',
            },
          },
        ],
      },
    ],
    max_tokens: 100,
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    return { type: 'other', confidence: 0 };
  }

  const parsed = JSON.parse(content);
  return {
    type: parsed.type || 'other',
    confidence: parsed.confidence || 0,
  };
}

/**
 * Validate if an image is a valid document (not blank, not a photo of person, etc.)
 */
export async function validateDocumentImage(
  imageUrl: string
): Promise<{
  isValid: boolean;
  reason?: string;
  suggestedType?: string;
}> {
  const response = await getOpenAIClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this image and determine if it's a valid document image suitable for immigration case processing.

Invalid images include:
- Blank or mostly blank images
- Photos of people without document context
- Screenshots of websites
- Illegible or very low quality images
- Irrelevant content

Respond with JSON:
{
  "isValid": true/false,
  "reason": "explanation if invalid",
  "suggestedType": "document type if valid"
}`,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'low',
            },
          },
        ],
      },
    ],
    max_tokens: 200,
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    return { isValid: false, reason: 'Unable to analyze image' };
  }

  return JSON.parse(content);
}

export const openaiClient = getOpenAIClient;
