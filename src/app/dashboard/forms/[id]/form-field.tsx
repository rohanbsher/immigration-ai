'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { ConfidenceIndicator } from '@/components/ai';
import type { FormField as FormFieldType } from '@/lib/forms/definitions';

interface FormFieldProps {
  field: FormFieldType;
  value: string | boolean | number;
  onChange: (value: string | boolean | number) => void;
  confidence?: number;
  aiSuggested?: boolean;
}

export function FormFieldComponent({ field, value, onChange, confidence, aiSuggested }: FormFieldProps) {
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
            {field.validation?.required && <span className="text-destructive">*</span>}
          </Label>
          {aiSuggested && confidence !== undefined && (
            <ConfidenceIndicator confidence={confidence} size="sm" />
          )}
          {aiSuggested && (
            <Badge variant="secondary" className="bg-ai-accent-muted text-ai-accent text-xs">
              <Sparkles size={10} className="mr-1" />
              AI
            </Badge>
          )}
        </div>
      )}
      {renderField()}
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
    </div>
  );
}
