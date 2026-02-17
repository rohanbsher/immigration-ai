'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { ConfidenceIndicator } from './confidence-indicator';

interface ExtractedField {
  field_name: string;
  value: string | null;
  confidence: number;
  requires_verification: boolean;
  source_location?: string;
}

interface ExtractionResultsProps {
  documentType: string;
  fields: ExtractedField[];
  overallConfidence: number;
  warnings?: string[];
  onFieldUpdate?: (fieldName: string, newValue: string) => void;
  className?: string;
}

export function ExtractionResults({
  documentType,
  fields,
  overallConfidence,
  warnings,
  onFieldUpdate,
  className,
}: ExtractionResultsProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['extracted']);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const startEditing = (field: ExtractedField) => {
    setEditingField(field.field_name);
    setEditValue(field.value || '');
  };

  const saveEdit = (fieldName: string) => {
    if (onFieldUpdate) {
      onFieldUpdate(fieldName, editValue);
    }
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Group fields by confidence level
  const highConfidenceFields = fields.filter((f) => f.confidence >= 0.9);
  const mediumConfidenceFields = fields.filter(
    (f) => f.confidence >= 0.7 && f.confidence < 0.9
  );
  const lowConfidenceFields = fields.filter((f) => f.confidence < 0.7);
  const fieldsRequiringVerification = fields.filter((f) => f.requires_verification);

  const formatFieldName = (name: string) => {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">
                {formatFieldName(documentType)}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {fields.length} fields extracted
              </p>
            </div>
          </div>
          <ConfidenceIndicator confidence={overallConfidence} size="lg" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning-foreground">Warnings</p>
                <ul className="text-sm text-warning-foreground/80 mt-1 space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Fields requiring verification */}
        {fieldsRequiringVerification.length > 0 && (
          <Collapsible
            open={expandedSections.includes('verification')}
            onOpenChange={() => toggleSection('verification')}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-3 bg-warning/10 hover:bg-warning/15"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="font-medium text-warning-foreground">
                    Requires Verification ({fieldsRequiringVerification.length})
                  </span>
                </div>
                {expandedSections.includes('verification') ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-2">
                {fieldsRequiringVerification.map((field) => (
                  <FieldRow
                    key={field.field_name}
                    field={field}
                    isEditing={editingField === field.field_name}
                    editValue={editValue}
                    onEdit={() => startEditing(field)}
                    onSave={() => saveEdit(field.field_name)}
                    onCancel={cancelEdit}
                    onEditValueChange={setEditValue}
                    formatFieldName={formatFieldName}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* All extracted fields */}
        <Collapsible
          open={expandedSections.includes('extracted')}
          onOpenChange={() => toggleSection('extracted')}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-3 bg-muted/50 hover:bg-muted"
            >
              <span className="font-medium">All Extracted Fields</span>
              {expandedSections.includes('extracted') ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-2">
              {fields.map((field) => (
                <FieldRow
                  key={field.field_name}
                  field={field}
                  isEditing={editingField === field.field_name}
                  editValue={editValue}
                  onEdit={() => startEditing(field)}
                  onSave={() => saveEdit(field.field_name)}
                  onCancel={cancelEdit}
                  onEditValueChange={setEditValue}
                  formatFieldName={formatFieldName}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Confidence breakdown */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-success">
              {highConfidenceFields.length}
            </div>
            <div className="text-xs text-muted-foreground">High Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning">
              {mediumConfidenceFields.length}
            </div>
            <div className="text-xs text-muted-foreground">Medium</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">
              {lowConfidenceFields.length}
            </div>
            <div className="text-xs text-muted-foreground">Needs Review</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FieldRowProps {
  field: ExtractedField;
  isEditing: boolean;
  editValue: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEditValueChange: (value: string) => void;
  formatFieldName: (name: string) => string;
}

function FieldRow({
  field,
  isEditing,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onEditValueChange,
  formatFieldName,
}: FieldRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg',
        field.requires_verification ? 'bg-warning/10' : 'bg-muted/50'
      )}
    >
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
        {isEditing ? (
          <Input
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            className="mt-1 h-8 text-sm"
            autoFocus
          />
        ) : (
          <p className="text-sm text-muted-foreground truncate">
            {field.value || <span className="italic text-muted-foreground/60">Not found</span>}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        {isEditing ? (
          <>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSave}>
              <Check className="h-4 w-4 text-success" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </>
        ) : (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Edit2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}
