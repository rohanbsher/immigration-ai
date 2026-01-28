import { NextRequest, NextResponse } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { generateFormPDF, isPDFGenerationSupported } from '@/lib/pdf';
import { auditService } from '@/lib/audit';
import type { FormType } from '@/types';

/**
 * GET /api/forms/[id]/pdf
 * Generate and download a filled PDF for the form.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the form
    const form = await formsService.getForm(id);
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Verify access via the case
    const caseData = await casesService.getCase(form.case_id);
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const isAttorney = caseData.attorney_id === user.id;
    const isClient = caseData.client_id === user.id;

    if (!isAttorney && !isClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if PDF generation is supported for this form type
    const formType = form.form_type as FormType;
    if (!isPDFGenerationSupported(formType)) {
      return NextResponse.json(
        { error: `PDF generation not yet supported for form type: ${formType}` },
        { status: 400 }
      );
    }

    // Generate the PDF
    const result = await generateFormPDF({
      id: form.id,
      formType,
      data: form.form_data as Record<string, unknown>,
      aiFilledData: form.ai_filled_data as Record<string, unknown> | undefined,
      createdAt: form.created_at,
      updatedAt: form.updated_at,
    });

    if (!result.success || !result.pdfBytes) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate PDF' },
        { status: 500 }
      );
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
        downloaded_by: isAttorney ? 'attorney' : 'client',
      },
    });

    // Return the PDF as a downloadable file
    // Convert Uint8Array to Buffer for NextResponse compatibility
    const buffer = Buffer.from(result.pdfBytes);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
