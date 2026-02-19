'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertTriangle,
  CheckCircle,
  Edit2,
  FileText,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { ConfidenceIndicator } from './confidence-indicator';

interface FieldCitation {
  type: string;
  documentType?: string;
  documentId?: string;
  citedText: string;
  pageNumber?: number;
}

interface FieldToVerify {
  field_id: string;
  field_name: string;
  suggested_value: string;
  confidence: number;
  source_document?: string;
  current_value?: string;
  citations?: FieldCitation[];
}

interface FieldVerificationProps {
  formType: string;
  fields: FieldToVerify[];
  onComplete: (verifiedFields: Record<string, string>) => void;
  onCancel: () => void;
  className?: string;
}

export function FieldVerification({
  formType,
  fields,
  onComplete,
  onCancel,
  className,
}: FieldVerificationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [verifiedFields, setVerifiedFields] = useState<Record<string, string>>({});
  const [editedValue, setEditedValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const currentField = fields[currentIndex];
  const isLastField = currentIndex === fields.length - 1;
  const isFirstField = currentIndex === 0;

  const handleAccept = () => {
    const value = isEditing ? editedValue : currentField.suggested_value;
    setVerifiedFields((prev) => ({
      ...prev,
      [currentField.field_id]: value,
    }));
    setIsEditing(false);
    setEditedValue('');

    if (isLastField) {
      onComplete({
        ...verifiedFields,
        [currentField.field_id]: value,
      });
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    if (isLastField) {
      onComplete(verifiedFields);
    } else {
      setIsEditing(false);
      setEditedValue('');
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setIsEditing(false);
    setEditedValue('');
    setCurrentIndex((prev) => prev - 1);
  };

  const handleEdit = () => {
    setEditedValue(currentField.suggested_value);
    setIsEditing(true);
  };

  const formatFieldName = (name: string) => {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const verifiedCount = Object.keys(verifiedFields).length;
  const progress = Math.round(((currentIndex) / fields.length) * 100);

  return (
    <Card className={cn('max-w-2xl mx-auto', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Verify AI Suggestions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Form: {formType} • Field {currentIndex + 1} of {fields.length}
            </p>
          </div>
          <Badge variant="outline">
            {verifiedCount} verified
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current field */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">
              {formatFieldName(currentField.field_name)}
            </Label>
            <ConfidenceIndicator confidence={currentField.confidence} />
          </div>

          {/* Source document info */}
          {currentField.source_document && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Source: {currentField.source_document}</span>
            </div>
          )}

          {/* Citation evidence */}
          {currentField.citations && currentField.citations.length > 0 && (
            <CitationList citations={currentField.citations} />
          )}

          {/* Suggested value */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">AI Suggested Value</Label>
            {isEditing ? (
              <Input
                value={editedValue}
                onChange={(e) => setEditedValue(e.target.value)}
                className="text-lg"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-medium flex-1">
                  {currentField.suggested_value || (
                    <span className="text-muted-foreground/60 italic">No value suggested</span>
                  )}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="text-muted-foreground"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            )}
          </div>

          {/* Current value comparison */}
          {currentField.current_value && currentField.current_value !== currentField.suggested_value && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm text-muted-foreground">Current Value</Label>
              <p className="text-sm text-foreground">{currentField.current_value}</p>
              {currentField.confidence < 0.8 && (
                <div className="flex items-start gap-2 text-sm text-warning-foreground bg-warning/10 p-2 rounded">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    The AI suggestion differs from the current value and has low confidence.
                    Please verify carefully.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Already verified */}
        {verifiedCount > 0 && (
          <div className="border rounded-lg p-3">
            <p className="text-sm font-medium text-foreground mb-2">
              Verified Fields ({verifiedCount})
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(verifiedFields).map(([fieldId]) => {
                const field = fields.find((f) => f.field_id === fieldId);
                return (
                  <Badge
                    key={fieldId}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="h-3 w-3 text-success" />
                    {field ? formatFieldName(field.field_name) : fieldId}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={isFirstField}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Skip
            {!isLastField && <ArrowRight className="h-4 w-4 ml-1" />}
          </Button>
          <Button onClick={handleAccept}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {isEditing ? 'Save' : 'Accept'}
            {!isLastField && <ArrowRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

interface QuickVerificationProps {
  fields: FieldToVerify[];
  onVerify: (fieldId: string, value: string) => void;
  className?: string;
}

export function QuickVerificationList({
  fields,
  onVerify,
  className,
}: QuickVerificationProps) {
  const [verified, setVerified] = useState<Set<string>>(new Set());

  const handleVerify = (field: FieldToVerify) => {
    setVerified((prev) => new Set([...prev, field.field_id]));
    onVerify(field.field_id, field.suggested_value);
  };

  const formatFieldName = (name: string) => {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className={cn('space-y-2', className)}>
      {fields.map((field) => (
        <div
          key={field.field_id}
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg border',
            verified.has(field.field_id)
              ? 'bg-success/10 border-success/30'
              : 'bg-card border-border'
          )}
        >
          <Checkbox
            checked={verified.has(field.field_id)}
            onCheckedChange={() => handleVerify(field)}
            disabled={verified.has(field.field_id)}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {formatFieldName(field.field_name)}
              </span>
              <ConfidenceIndicator
                confidence={field.confidence}
                size="sm"
                showLabel={false}
              />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {field.suggested_value || (
                <span className="italic text-muted-foreground/60">No value</span>
              )}
            </p>
          </div>

          {verified.has(field.field_id) && (
            <CheckCircle className="h-5 w-5 text-success" />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Citation display component
// ---------------------------------------------------------------------------

interface CitationListProps {
  citations: FieldCitation[];
}

function CitationList({ citations }: CitationListProps) {
  const [expanded, setExpanded] = useState(false);
  const displayCitations = expanded ? citations : citations.slice(0, 1);

  const formatDocType = (docType?: string) => {
    if (!docType) return 'Document';
    return docType
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Cited from ({citations.length}):
      </p>
      {displayCitations.map((citation, i) => (
        <div
          key={i}
          className="flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2 rounded"
        >
          <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
          <div className="min-w-0">
            <span className="font-medium text-blue-700 dark:text-blue-300">
              {formatDocType(citation.documentType)}
              {citation.pageNumber ? ` (p. ${citation.pageNumber})` : ''}
            </span>
            <p className="text-muted-foreground mt-0.5 italic break-words">
              &ldquo;{citation.citedText.length > 120
                ? citation.citedText.slice(0, 120) + '...'
                : citation.citedText}&rdquo;
            </p>
          </div>
        </div>
      ))}
      {citations.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expanded
            ? 'Show less'
            : `Show ${citations.length - 1} more citation${citations.length - 1 > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
