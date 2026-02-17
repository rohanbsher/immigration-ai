'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { FormSection } from '@/lib/forms/definitions';
import { FormFieldComponent } from './form-field';

interface SectionProps {
  section: FormSection;
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  aiData?: Record<string, { value: unknown; confidence: number }>;
}

export function FormSectionComponent({ section, values, onChange, aiData }: SectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const filledFields = section.fields.filter(
    (f) => values[f.id] !== undefined && values[f.id] !== ''
  ).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50">
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
              <p className="text-sm text-muted-foreground ml-7">{section.description}</p>
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
