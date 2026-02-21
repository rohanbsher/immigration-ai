import { z } from 'zod';
import { getDocumentChecklist } from '@/lib/db/document-checklists';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import type { VisaType } from '@/types';

const VALID_VISA_TYPES: VisaType[] = [
  'B1B2', 'F1', 'H1B', 'H4', 'L1', 'O1',
  'EB1', 'EB2', 'EB3', 'EB5',
  'I-130', 'I-485', 'I-765', 'I-131', 'N-400',
  'other',
];

const visaTypeSchema = z.enum(VALID_VISA_TYPES as [VisaType, ...VisaType[]]);

/**
 * GET /api/document-checklists/[visaType]
 *
 * Returns the document checklist for a specific visa type.
 * Requires authentication.
 */
export const GET = withAuth(async (_request, context, _auth) => {
  const { visaType } = await context.params!;

  // Validate visa type
  const validation = visaTypeSchema.safeParse(visaType);
  if (!validation.success) {
    return errorResponse('Invalid visa type', 400, { validTypes: VALID_VISA_TYPES });
  }

  // Get checklist
  const checklist = getDocumentChecklist(validation.data);

  if (!checklist) {
    return errorResponse('Document checklist not found for this visa type', 404);
  }

  return successResponse(checklist);
}, { rateLimit: 'STANDARD' });
