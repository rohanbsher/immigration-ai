'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Loader2, AlertCircle, X, CheckCircle2, FileWarning } from 'lucide-react';
import type { FormDefinition } from '@/lib/forms/definitions';

interface FillStats {
  filled: number;
  total: number;
  formType: string;
}

interface FormPreviewTabProps {
  formDefinition: FormDefinition;
  formValues: Record<string, unknown>;
  formId: string;
}

export function FormPreviewTab({ formDefinition, formValues, formId }: FormPreviewTabProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfType, setPdfType] = useState<'filing-ready' | 'draft' | null>(null);
  const [fillStats, setFillStats] = useState<FillStats | null>(null);

  const handlePreviewPDF = useCallback(async () => {
    setIsLoadingPdf(true);
    setPdfError(null);
    setPdfType(null);
    setFillStats(null);
    try {
      const response = await fetch(`/api/forms/${formId}/pdf`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate PDF' }));
        throw new Error(error.error || 'Failed to generate PDF');
      }

      // Read metadata headers
      const typeHeader = response.headers.get('X-PDF-Type');
      if (typeHeader === 'filing-ready' || typeHeader === 'draft') {
        setPdfType(typeHeader);
      }
      const statsHeader = response.headers.get('X-Fill-Stats');
      if (statsHeader) {
        try {
          setFillStats(JSON.parse(statsHeader));
        } catch { /* ignore parse errors */ }
      }

      const blob = await response.blob();
      // Revoke previous URL if any
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Failed to load PDF preview');
    } finally {
      setIsLoadingPdf(false);
    }
  }, [formId, pdfUrl]);

  const handleClosePdf = useCallback(() => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl(null);
    setPdfError(null);
  }, [pdfUrl]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  return (
    <div className="space-y-6">
      {/* PDF Preview Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>PDF Preview</CardTitle>
            <div className="flex gap-2">
              {pdfUrl && (
                <Button variant="ghost" size="sm" onClick={handleClosePdf}>
                  <X className="h-4 w-4 mr-1" />
                  Close Preview
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handlePreviewPDF}
                disabled={isLoadingPdf}
              >
                {isLoadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye size={16} />
                )}
                {isLoadingPdf ? 'Generating...' : pdfUrl ? 'Refresh Preview' : 'Preview PDF'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pdfError && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-4">
              <AlertCircle className="h-4 w-4" />
              <span>{pdfError}</span>
            </div>
          )}
          {pdfUrl ? (
            <>
              {/* PDF type badge + fill stats bar */}
              {pdfType && (
                <div className="flex items-center gap-3 mb-3 p-2 rounded-md bg-muted/50">
                  {pdfType === 'filing-ready' ? (
                    <Badge className="bg-green-600 text-white hover:bg-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Filing Ready
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                      <FileWarning className="h-3 w-3" />
                      Draft
                    </Badge>
                  )}
                  {fillStats && (
                    <span className="text-sm text-muted-foreground">
                      {fillStats.filled}/{fillStats.total} fields filled
                    </span>
                  )}
                </div>
              )}
              <iframe
                src={pdfUrl}
                className="w-full border rounded-lg"
                style={{ height: '800px' }}
                title="PDF Preview"
              />
            </>
          ) : (
            !pdfError && (
              <p className="text-sm text-muted-foreground">
                Click &quot;Preview PDF&quot; to generate and view the filled PDF form.
              </p>
            )
          )}
        </CardContent>
      </Card>

      {/* Existing field-value list */}
      <Card>
        <CardHeader>
          <CardTitle>Field Values</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {formDefinition.sections.map((section) => (
              <div key={section.id}>
                <h3 className="font-semibold text-foreground mb-3 pb-2 border-b">
                  {section.title}
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {section.fields.map((field) => {
                    const value = formValues[field.id];
                    if (!value && value !== 0) return null;

                    let displayValue = String(value);
                    if (field.type === 'select' || field.type === 'radio') {
                      const option = field.options?.find((o) => o.value === value);
                      displayValue = option?.label || displayValue;
                    }

                    return (
                      <div key={field.id}>
                        <p className="text-sm text-muted-foreground">{field.label}</p>
                        <p className="font-medium">{displayValue}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
