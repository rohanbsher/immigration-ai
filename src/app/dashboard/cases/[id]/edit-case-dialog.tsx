'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useUpdateCase } from '@/hooks/use-cases';
import { toast } from 'sonner';
import { visaTypeOptions } from './constants';
import type { VisaType } from '@/types';

interface EditCaseDialogProps {
  caseId: string;
  caseData: {
    title: string;
    description: string | null;
    visa_type: string;
    deadline: string | null;
    priority_date: string | null;
    notes: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCaseDialog({ caseId, caseData, open, onOpenChange }: EditCaseDialogProps) {
  const { mutate: updateCase, isPending: isUpdating } = useUpdateCase();
  const [editData, setEditData] = useState({
    title: caseData.title || '',
    description: caseData.description || '',
    visa_type: caseData.visa_type || '',
    deadline: caseData.deadline ? caseData.deadline.split('T')[0] : '',
    priority_date: caseData.priority_date ? caseData.priority_date.split('T')[0] : '',
    notes: caseData.notes || '',
  });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setEditData({
        title: caseData.title || '',
        description: caseData.description || '',
        visa_type: caseData.visa_type || '',
        deadline: caseData.deadline ? caseData.deadline.split('T')[0] : '',
        priority_date: caseData.priority_date ? caseData.priority_date.split('T')[0] : '',
        notes: caseData.notes || '',
      });
    }
    onOpenChange(isOpen);
  };

  const handleSave = () => {
    updateCase(
      {
        id: caseId,
        data: {
          title: editData.title,
          description: editData.description || undefined,
          visa_type: (editData.visa_type as VisaType) || undefined,
          deadline: editData.deadline || undefined,
          priority_date: editData.priority_date || undefined,
          notes: editData.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Case updated successfully');
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to update case');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Case</DialogTitle>
          <DialogDescription>
            Update the case details below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={editData.title}
              onChange={(e) => setEditData((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-visa-type">Visa Type</Label>
            <select
              id="edit-visa-type"
              value={editData.visa_type}
              onChange={(e) => setEditData((prev) => ({ ...prev, visa_type: e.target.value }))}
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {visaTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <textarea
              id="edit-description"
              value={editData.description}
              onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-deadline">Deadline</Label>
              <Input
                id="edit-deadline"
                type="date"
                value={editData.deadline}
                onChange={(e) => setEditData((prev) => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-priority-date">Priority Date</Label>
              <Input
                id="edit-priority-date"
                type="date"
                value={editData.priority_date}
                onChange={(e) => setEditData((prev) => ({ ...prev, priority_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea
              id="edit-notes"
              value={editData.notes}
              onChange={(e) => setEditData((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!editData.title || isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
