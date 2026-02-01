import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverAuth } from '@/lib/auth';
import { getDocumentChecklist } from '@/lib/db/document-checklists';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import type { VisaType } from '@/types';

const VALID_VISA_TYPES: VisaType[] = [
  'B1B2', 'F1', 'H1B', 'H4', 'L1', 'O1',
  'EB1', 'EB2', 'EB3', 'EB5',
  'I-130', 'I-485', 'I-765', 'I-131', 'N-400',
  'other',
];

const visaTypeSchema = z.enum(VALID_VISA_TYPES as [VisaType, ...VisaType[]]);

interface Params {
  params: Promise<{ visaType: string }>;
}

/**
 * GET /api/document-checklists/[visaType]
 *
 * Returns the document checklist for a specific visa type.
 * Requires authentication.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { visaType } = await params;

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' }
        }
      );
    }

    // Authentication
    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate visa type
    const validation = visaTypeSchema.safeParse(visaType);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid visa type',
          validTypes: VALID_VISA_TYPES,
        },
        { status: 400 }
      );
    }

    // Get checklist
    const checklist = getDocumentChecklist(validation.data);

    if (!checklist) {
      return NextResponse.json(
        { error: 'Document checklist not found for this visa type' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: checklist,
    });
  } catch (error) {
    console.error('Get document checklist error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document checklist' },
      { status: 500 }
    );
  }
}
