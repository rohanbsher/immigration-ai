'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ArrowLeft,
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useForm, useUpdateForm, useAutofillForm } from '@/hooks/use-forms';
import { getFormDefinition, FormField as FormFieldType, FormSection } from '@/lib/forms/definitions';
import { ConfidenceIndicator } from '@/components/ai';
import { toast } from 'sonner';

interface FormFieldProps {
  field: FormFieldType;
  value: string | boolean | number;
  onChange: (value: string | boolean | number) => void;
  confidence?: number;
  aiSuggested?: boolean;
}

function FormFieldComponent({ field, value, onChange, confidence, aiSuggested }: FormFieldProps) {
  const renderField = () => {
    switch (field.type) {
      case 'select':
        return (
          <select
            id={field.id}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="flex gap-4">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">{field.label}</span>
          </label>
        );

      case 'textarea':
        return (
          <textarea
            id={field.id}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
          />
        );

      case 'date':
        return (
          <Input
            id={field.id}
            type="date"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case 'number':
        return (
          <Input
            id={field.id}
            type="number"
            value={value as number}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );

      default:
        return (
          <Input
            id={field.id}
            type={field.type === 'email' ? 'email' : 'text'}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  };

  const widthClass =
    field.width === 'half'
      ? 'md:col-span-1'
      : field.width === 'third'
      ? 'lg:col-span-1'
      : 'col-span-full';

  return (
    <div className={`space-y-2 ${widthClass}`}>
      {field.type !== 'checkbox' && (
        <div className="flex items-center gap-2">
          <Label htmlFor={field.id} className="flex items-center gap-1">
            {field.label}
            {field.validation?.required && <span className="text-red-500">*</span>}
          </Label>
          {aiSuggested && confidence !== undefined && (
            <ConfidenceIndicator confidence={confidence} size="sm" />
          )}
          {aiSuggested && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
              <Sparkles size={10} className="mr-1" />
              AI
            </Badge>
          )}
        </div>
      )}
      {renderField()}
      {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}
    </div>
  );
}

interface SectionProps {
  section: FormSection;
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  aiData?: Record<string, { value: unknown; confidence: number }>;
}

function FormSectionComponent({ section, values, onChange, aiData }: SectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const filledFields = section.fields.filter(
    (f) => values[f.id] !== undefined && values[f.id] !== ''
  ).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </div>
              <Badge variant="secondary">
                {filledFields}/{section.fields.length} fields
              </Badge>
            </div>
            {section.description && (
              <p className="text-sm text-slate-500 ml-7">{section.description}</p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.fields.map((field) => {
                const aiFieldData = field.aiFieldKey ? aiData?.[field.aiFieldKey] : undefined;
                const currentValue =
                  values[field.id] ?? aiFieldData?.value ?? field.defaultValue ?? '';

                return (
                  <FormFieldComponent
                    key={field.id}
                    field={field}
                    value={currentValue as string | boolean | number}
                    onChange={(value) => onChange(field.id, value)}
                    confidence={aiFieldData?.confidence}
                    aiSuggested={!!aiFieldData}
                  />
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: form, isLoading, error } = useForm(id);
  const { mutate: updateForm, isPending: isSaving } = useUpdateForm();
  const { mutate: autofillForm, isPending: isAutofilling } = useAutofillForm();

  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');

  // Load form data when available - sync server data to local state for editing
  useEffect(() => {
    if (form?.form_data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from server data
      setFormValues(form.form_data as Record<string, unknown>);
    }
  }, [form]);

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
        onError: (error) => {
          toast.error(error.message || 'Failed to save form');
        },
      }
    );
  };

  const handleAutofill = () => {
    autofillForm(id, {
      onSuccess: (updatedForm) => {
        toast.success('Form autofilled with AI');
        // Update local form values with AI-filled data
        if (updatedForm.form_data) {
          setFormValues(updatedForm.form_data as Record<string, unknown>);
        }
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to autofill form');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
            <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
            <p className="text-slate-600">Form not found or you don&apos;t have access.</p>
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
            <AlertCircle className="h-12 w-12 mx-auto text-yellow-400 mb-4" />
            <p className="text-slate-600">
              Form type &quot;{form.form_type}&quot; is not yet supported.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadgeMap: Record<string, { color: string; label: string }> = {
    draft: { color: 'bg-slate-100 text-slate-700', label: 'Draft' },
    ai_filled: { color: 'bg-purple-100 text-purple-700', label: 'AI Filled' },
    in_review: { color: 'bg-yellow-100 text-yellow-700', label: 'In Review' },
    approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
    filed: { color: 'bg-blue-100 text-blue-700', label: 'Filed' },
  };
  const statusBadge = statusBadgeMap[form.status] || { color: 'bg-slate-100 text-slate-700', label: form.status };

  // Calculate completion percentage
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Form {formDefinition.formType}
            </h1>
            <Badge className={statusBadge.color}>{statusBadge.label}</Badge>
          </div>
          <p className="text-slate-600">{formDefinition.title}</p>
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
          <Button onClick={handleSave} disabled={!hasChanges || isSaving} className="gap-2">
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
            <span className="text-sm font-medium text-slate-700">Form Completion</span>
            <span className="text-sm text-slate-600">
              {filledRequiredFields} / {totalRequiredFields} required fields
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
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
          <Card>
            <CardHeader>
              <CardTitle>Form Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {formDefinition.sections.map((section) => (
                  <div key={section.id}>
                    <h3 className="font-semibold text-slate-900 mb-3 pb-2 border-b">
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
                            <p className="text-sm text-slate-500">{field.label}</p>
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
        </TabsContent>

        <TabsContent value="instructions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info size={20} />
                Form Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate max-w-none">
              <div className="grid md:grid-cols-3 gap-4 mb-6 not-prose">
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-sm text-slate-500">Estimated Time</p>
                  <p className="font-semibold">{formDefinition.estimatedTime || 'N/A'}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-sm text-slate-500">Filing Fee</p>
                  <p className="font-semibold">
                    {formDefinition.filingFee ? `$${formDefinition.filingFee}` : 'N/A'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-sm text-slate-500">USCIS Form Number</p>
                  <p className="font-semibold">{formDefinition.uscisFormNumber}</p>
                </div>
              </div>
              <p className="whitespace-pre-wrap">{formDefinition.instructions}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-4 shadow-lg flex items-center gap-3">
          <AlertCircle className="text-yellow-600" size={20} />
          <span className="text-sm text-yellow-800">You have unsaved changes</span>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Now'}
          </Button>
        </div>
      )}
    </div>
  );
}
