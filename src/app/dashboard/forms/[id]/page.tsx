'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
  AlertCircle,
  FileDown,
} from 'lucide-react';
import { useForm, useUpdateForm, useAutofillForm } from '@/hooks/use-forms';
import { getFormDefinition } from '@/lib/forms/definitions';
import { getAutofillGaps } from '@/lib/ai/form-autofill';
import { toast } from 'sonner';
import { Breadcrumbs, generateFormBreadcrumbs } from '@/components/ui/breadcrumbs';
import { DocumentPrompt } from '@/components/forms/document-prompt';

import { FormSectionComponent } from './form-section';
import { FormPreviewTab } from './form-preview-tab';
import { FormInstructionsTab } from './form-instructions-tab';

const STATUS_BADGE_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'bg-muted text-muted-foreground', label: 'Draft' },
  ai_filled: { color: 'bg-ai-accent-muted text-ai-accent', label: 'AI Filled' },
  in_review: { color: 'bg-warning/10 text-warning', label: 'In Review' },
  approved: { color: 'bg-success/10 text-success', label: 'Approved' },
  filed: { color: 'bg-info/10 text-info', label: 'Filed' },
};

export default function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: form, isLoading, error } = useForm(id);
  const { mutate: updateForm, isPending: isSaving } = useUpdateForm();
  const { mutate: autofillForm, isPending: isAutofilling } = useAutofillForm();

  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (form?.form_data && !isInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from server data
      setFormValues(form.form_data as Record<string, unknown>);
      setIsInitialized(true);
    }
  }, [form?.form_data, isInitialized]);

  // Compute autofill gaps — must be above early returns to satisfy Rules of Hooks
  const autofillGaps = useMemo(() => {
    if (!form || form.status === 'draft') return [];

    const filledFieldIds = Object.entries(formValues)
      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
      .map(([k]) => k);

    // We don't have direct access to case documents here, so pass an empty
    // list. The gaps function will treat all documents as missing, which
    // is the safe default — it may over-prompt but won't under-prompt.
    // TODO: Fetch case document types via API to provide accurate gap analysis.
    const uploadedDocTypes: string[] = [];
    return getAutofillGaps(form.form_type, filledFieldIds, uploadedDocTypes);
  }, [form, formValues]);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateForm(
      { id, data: { form_data: formValues } },
      {
        onSuccess: () => {
          toast.success('Form saved successfully');
          setHasChanges(false);
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to save form');
        },
      }
    );
  };

  const handleAutofill = () => {
    autofillForm(id, {
      onSuccess: (updatedForm) => {
        toast.success('Form autofilled with AI');
        if (updatedForm.form_data) {
          setFormValues(updatedForm.form_data as Record<string, unknown>);
        }
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to autofill form');
      },
    });
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/forms/${id}/pdf`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate PDF' }));
        throw new Error(error.error || 'Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `${form?.form_type || 'form'}_form.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive/60 mb-4" />
            <p className="text-muted-foreground">Form not found or you don&apos;t have access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formDefinition = getFormDefinition(form.form_type);

  if (!formDefinition) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-warning/60 mb-4" />
            <p className="text-muted-foreground">
              Form type &quot;{form.form_type}&quot; is not yet supported.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE_MAP[form.status] || {
    color: 'bg-muted text-muted-foreground',
    label: form.status,
  };

  const totalRequiredFields = formDefinition.sections.reduce(
    (count, section) =>
      count + section.fields.filter((f) => f.validation?.required).length,
    0
  );
  const filledRequiredFields = formDefinition.sections.reduce(
    (count, section) =>
      count +
      section.fields.filter(
        (f) =>
          f.validation?.required &&
          formValues[f.id] !== undefined &&
          formValues[f.id] !== ''
      ).length,
    0
  );
  const completionPercent = totalRequiredFields > 0
    ? Math.round((filledRequiredFields / totalRequiredFields) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={generateFormBreadcrumbs(form.case_id, 'Case', formDefinition.formType)} />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl tracking-tight text-foreground">
              Form {formDefinition.formType}
            </h1>
            <Badge className={statusBadge.color}>{statusBadge.label}</Badge>
          </div>
          <p className="text-muted-foreground">{formDefinition.title}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleAutofill}
            disabled={isAutofilling}
          >
            {isAutofilling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {isAutofilling ? 'Autofilling...' : 'AI Autofill'}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown size={16} />
            )}
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving || isAutofilling} className="gap-2">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Form Completion</span>
            <span className="text-sm text-muted-foreground">
              {filledRequiredFields} / {totalRequiredFields} required fields
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="edit">Edit Form</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4 mt-6">
          {autofillGaps.length > 0 && (
            <DocumentPrompt gaps={autofillGaps} caseId={form.case_id} />
          )}
          {formDefinition.sections.map((section) => (
            <FormSectionComponent
              key={section.id}
              section={section}
              values={formValues}
              onChange={handleFieldChange}
              aiData={form.ai_filled_data as Record<string, { value: unknown; confidence: number }> | undefined}
            />
          ))}
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <FormPreviewTab formDefinition={formDefinition} formValues={formValues} formId={id} />
        </TabsContent>

        <TabsContent value="instructions" className="mt-6">
          <FormInstructionsTab formDefinition={formDefinition} />
        </TabsContent>
      </Tabs>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-warning/10 border border-warning/30 rounded-lg p-4 shadow-lg flex items-center gap-3">
          <AlertCircle className="text-warning" size={20} />
          <span className="text-sm text-warning-foreground">You have unsaved changes</span>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Now'}
          </Button>
        </div>
      )}
    </div>
  );
}
