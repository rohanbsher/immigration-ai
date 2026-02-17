import { NextRequest, NextResponse } from 'next/server';

/**
 * Safely parse the JSON body of an incoming request.
 * Returns a discriminated union so callers can early-return on malformed JSON.
 */
export async function safeParseBody<T = unknown>(request: NextRequest): Promise<
  | { success: true; data: T }
  | { success: false; response: NextResponse }
> {
  try {
    const data = await request.json() as T;
    return { success: true, data };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      ),
    };
  }
}
