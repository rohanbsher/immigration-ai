'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DetailsStepProps {
  title: string;
  description: string;
  priorityDate: string;
  deadline: string;
  notes: string;
  onFieldChange: (field: string, value: string) => void;
}

export function DetailsStep({
  title,
  description,
  priorityDate,
  deadline,
  notes,
  onFieldChange,
}: DetailsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Case Details</h2>
        <p className="text-muted-foreground">
          Provide additional information about this case.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Case Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => onFieldChange('title', e.target.value)}
            placeholder="e.g., I-130 Application - John Doe"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => onFieldChange('description', e.target.value)}
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Brief description of the case..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="priority_date">Priority Date</Label>
            <Input
              id="priority_date"
              type="date"
              value={priorityDate}
              onChange={(e) => onFieldChange('priority_date', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => onFieldChange('deadline', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Internal Notes</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => onFieldChange('notes', e.target.value)}
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Any additional notes..."
          />
        </div>
      </div>
    </div>
  );
}
