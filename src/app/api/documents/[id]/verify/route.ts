import { withAuth, errorResponse, verifyDocumentAccess, successResponse } from '@/lib/auth/api-helpers';
import { documentsService } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:documents-verify');

export const POST = withAuth(async (_request, context, auth) => {
  try {
    const { id } = await context.params!;

    const access = await verifyDocumentAccess(auth.user.id, id);
    if (!access.success) {
      return errorResponse(access.error, access.status);
    }

    // Only the attorney assigned to this case can verify documents
    if (!access.access.isAttorney) {
      return errorResponse('Only the assigned attorney can verify documents', 403);
    }

    const verifiedDocument = await documentsService.verifyDocument(id, auth.user.id);

    return successResponse(verifiedDocument);
  } catch (error) {
    log.logError('Error verifying document', error);
    return errorResponse('Failed to verify document', 500);
  }
});
