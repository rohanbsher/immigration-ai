import { NextResponse } from 'next/server';
import { formsService } from '@/lib/db';
import { withAuth, errorResponse, verifyFormAccess } from '@/lib/auth/api-helpers';
import { generateFormPDF, isPDFGenerationSupported } from '@/lib/pdf';
import { auditService } from '@/lib/audit';
import { createLogger } from '@/lib/logger';
import type { FormType } from '@/types';

const log = createLogger('api:forms-pdf');

/**
 * GET /api/forms/[id]/pdf
 * Generate and download a filled PDF for the form.
 */
export const GET = withAuth(async (request, context, auth) => {
  try {
    const { id } = await context.params!;

    // Get the form
    const form = await formsService.getForm(id);
    if (!form) {
      return errorResponse('Form not found', 404);
    }

    // Verify access via the case
    const formAccess = await verifyFormAccess(auth.user.id, id);
    if (!formAccess.success) {
      return errorResponse(formAccess.error, formAccess.status);
    }

    // Check if PDF generation is supported for this form type
    const formType = form.form_type as FormType;
    if (!isPDFGenerationSupported(formType)) {
      return errorResponse(`PDF generation not yet supported for form type: ${formType}`, 400);
    }

    // Parse draft query param (summary PDFs default to draft; ?draft=false removes watermark)
    const url = new URL(request.url);
    const draftParam = url.searchParams.get('draft');

    // Generate the PDF
    const result = await generateFormPDF({
      id: form.id,
      formType,
      data: form.form_data as Record<string, unknown>,
      aiFilledData: form.ai_filled_data as Record<string, unknown> | undefined,
      createdAt: form.created_at,
      updatedAt: form.updated_at,
    }, {
      isDraft: draftParam != null ? draftParam !== 'false' : undefined,
    });

    if (!result.success || !result.pdfBytes) {
      return errorResponse(result.error || 'Failed to generate PDF', 500);
    }

    // Log the PDF generation for audit trail
    await auditService.log({
      table_name: 'forms',
      record_id: id,
      operation: 'access',
      additional_context: {
        action: 'pdf_download',
        form_type: formType,
        form_status: form.status,
        downloaded_by: formAccess.access.isAttorney ? 'attorney' : 'client',
      },
    });

    // Return the PDF as a downloadable file
    const buffer = Buffer.from(result.pdfBytes);
    const safeFileName = (result.fileName || 'form.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const pdfType = result.isAcroFormFilled ? 'filing-ready' : 'draft';
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-PDF-Type': pdfType,
      'Access-Control-Expose-Headers': 'X-PDF-Type, X-Fill-Stats',
    };

    if (result.filledFieldCount !== undefined && result.totalFieldCount !== undefined) {
      responseHeaders['X-Fill-Stats'] = JSON.stringify({
        filled: result.filledFieldCount,
        total: result.totalFieldCount,
        formType,
      });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    log.logError('Error generating PDF', error);
    return errorResponse('Failed to generate PDF', 500);
  }
});
