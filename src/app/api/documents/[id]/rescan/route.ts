import { NextRequest } from 'next/server';
import { documentsService } from '@/lib/db';
import { scanFileForViruses } from '@/lib/file-validation';
import { createClient } from '@/lib/supabase/server';
import {
  withAuth,
  successResponse,
  errorResponse,
  verifyDocumentAccess,
} from '@/lib/auth/api-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:documents-rescan');

/**
 * POST /api/documents/[id]/rescan
 *
 * Re-scans a document that was uploaded with degraded scan status.
 * Only attorneys can trigger a re-scan. The document must have
 * scan_status = 'degraded' (uploaded when scanner was unavailable).
 */
export const POST = withAuth(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params!;

    // Verify document access
    const accessResult = await verifyDocumentAccess(auth.user.id, id);
    if (!accessResult.success) {
      return errorResponse(accessResult.error, accessResult.status);
    }
    if (!accessResult.access.isAttorney) {
      return errorResponse('Only attorneys can trigger document re-scans', 403);
    }

    // Fetch document to check scan_status
    const document = await documentsService.getDocument(id);
    if (!document) {
      return errorResponse('Document not found', 404);
    }

    if (document.scan_status !== 'degraded') {
      return errorResponse(
        `Document scan status is "${document.scan_status}", not "degraded". Re-scan is only available for documents with degraded scan status.`,
        400
      );
    }

    // Download the file from storage to re-scan it
    const supabase = await createClient();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_url);

    if (downloadError || !fileData) {
      log.logError('Failed to download document for re-scan', downloadError || new Error('No file data'));
      return errorResponse('Failed to retrieve document for scanning', 500);
    }

    // Re-scan the file
    const scanResult = await scanFileForViruses(fileData);

    if (scanResult.isClean) {
      // Update document to clean status
      await documentsService.updateDocument(id, {
        scan_status: 'clean',
      } as Parameters<typeof documentsService.updateDocument>[1]);

      log.info('Document re-scan completed: clean', {
        documentId: id,
        userId: auth.user.id,
        provider: scanResult.scanProvider,
      });

      return successResponse({
        status: 'clean',
        message: 'Document passed security scan and is now available.',
      });
    }

    // Check if scanner is still degraded
    const scannerDegradedReasons = [
      'SCAN_TIMEOUT',
      'SCAN_ERROR',
      'SCAN_FAILED',
      'SCANNER_NOT_CONFIGURED',
    ];

    const stillDegraded = scanResult.threatName && scannerDegradedReasons.includes(scanResult.threatName);

    if (stillDegraded) {
      log.warn('Document re-scan still degraded', {
        documentId: id,
        reason: scanResult.threatName,
        provider: scanResult.scanProvider,
      });

      return successResponse({
        status: 'degraded',
        message: 'Virus scanner is still unavailable. Please try again later.',
      });
    }

    // Real threat detected — mark as infected and block access
    await documentsService.updateDocument(id, {
      scan_status: 'infected',
    } as Parameters<typeof documentsService.updateDocument>[1]);

    log.warn('Document re-scan detected threat', {
      documentId: id,
      threatName: scanResult.threatName,
      provider: scanResult.scanProvider,
      userId: auth.user.id,
    });

    return successResponse({
      status: 'infected',
      message: `Security threat detected: ${scanResult.threatName}. This document has been quarantined.`,
    });
  },
  { rateLimit: 'SENSITIVE', roles: ['attorney'] }
);
