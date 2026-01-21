'use client';

import { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

type InputProps = React.ComponentProps<'input'>;

export interface ValidatedInputProps extends InputProps {
  label?: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  helpText?: string;
  hideErrorIcon?: boolean;
}

export const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  (
    {
      label,
      error,
      touched,
      required,
      helpText,
      hideErrorIcon = false,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const showError = touched && error;
    const inputId = id || props.name;
    const errorId = `${inputId}-error`;
    const helpId = `${inputId}-help`;

    return (
      <div className="space-y-1.5">
        {label && (
          <Label htmlFor={inputId} className="text-sm font-medium">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            className={cn(
              showError && 'border-red-500 focus-visible:ring-red-500',
              showError && !hideErrorIcon && 'pr-10',
              className
            )}
            aria-invalid={showError ? 'true' : undefined}
            aria-describedby={
              showError ? errorId : helpText ? helpId : undefined
            }
            {...props}
          />
          {showError && !hideErrorIcon && (
            <AlertCircle
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500"
              aria-hidden="true"
            />
          )}
        </div>
        {showError && (
          <p id={errorId} className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {helpText && !showError && (
          <p id={helpId} className="text-sm text-slate-500">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';

// Textarea variant
import { Textarea } from '@/components/ui/textarea';

type TextareaProps = React.ComponentProps<'textarea'>;

export interface ValidatedTextareaProps extends TextareaProps {
  label?: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  helpText?: string;
}

export const ValidatedTextarea = forwardRef<
  HTMLTextAreaElement,
  ValidatedTextareaProps
>(({ label, error, touched, required, helpText, className, id, ...props }, ref) => {
  const showError = touched && error;
  const inputId = id || props.name;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Textarea
        ref={ref}
        id={inputId}
        className={cn(
          showError && 'border-red-500 focus-visible:ring-red-500',
          className
        )}
        aria-invalid={showError ? 'true' : undefined}
        aria-describedby={showError ? errorId : helpText ? helpId : undefined}
        {...props}
      />
      {showError && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {helpText && !showError && (
        <p id={helpId} className="text-sm text-slate-500">
          {helpText}
        </p>
      )}
    </div>
  );
});

ValidatedTextarea.displayName = 'ValidatedTextarea';

// Select variant
export interface ValidatedSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  helpText?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const ValidatedSelect = forwardRef<
  HTMLSelectElement,
  ValidatedSelectProps
>(
  (
    {
      label,
      error,
      touched,
      required,
      helpText,
      options,
      placeholder,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const showError = touched && error;
    const inputId = id || props.name;
    const errorId = `${inputId}-error`;
    const helpId = `${inputId}-help`;

    return (
      <div className="space-y-1.5">
        {label && (
          <Label htmlFor={inputId} className="text-sm font-medium">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            showError && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          aria-invalid={showError ? 'true' : undefined}
          aria-describedby={showError ? errorId : helpText ? helpId : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {showError && (
          <p id={errorId} className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {helpText && !showError && (
          <p id={helpId} className="text-sm text-slate-500">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

ValidatedSelect.displayName = 'ValidatedSelect';
