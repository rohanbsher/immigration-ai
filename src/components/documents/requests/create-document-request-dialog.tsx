'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCreateDocumentRequest } from '@/hooks/use-document-requests';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentType } from '@/types';

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'visa', label: 'Visa' },
  { value: 'i94', label: 'I-94' },
  { value: 'birth_certificate', label: 'Birth Certificate' },
  { value: 'marriage_certificate', label: 'Marriage Certificate' },
  { value: 'divorce_certificate', label: 'Divorce Certificate' },
  { value: 'employment_letter', label: 'Employment Letter' },
  { value: 'pay_stub', label: 'Pay Stub' },
  { value: 'tax_return', label: 'Tax Return' },
  { value: 'w2', label: 'W-2 Form' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'photo', label: 'Photo' },
  { value: 'medical_exam', label: 'Medical Exam' },
  { value: 'police_clearance', label: 'Police Clearance' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'recommendation_letter', label: 'Recommendation Letter' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface CreateDocumentRequestDialogProps {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDocumentRequestDialog({
  caseId,
  open,
  onOpenChange,
}: CreateDocumentRequestDialogProps) {
  const [formData, setFormData] = useState({
    document_type: '' as DocumentType | '',
    title: '',
    description: '',
    due_date: '',
    priority: 'normal',
  });

  const { mutate: createRequest, isPending } = useCreateDocumentRequest(caseId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.document_type || !formData.title) {
      toast.error('Please fill in required fields');
      return;
    }

    createRequest(
      {
        document_type: formData.document_type as DocumentType,
        title: formData.title,
        description: formData.description || undefined,
        due_date: formData.due_date || undefined,
        priority: formData.priority as 'low' | 'normal' | 'high' | 'urgent',
      },
      {
        onSuccess: () => {
          toast.success('Document request created');
          onOpenChange(false);
          setFormData({
            document_type: '',
            title: '',
            description: '',
            due_date: '',
            priority: 'normal',
          });
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create request');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Document from Client</DialogTitle>
          <DialogDescription>
            Create a request for your client to upload a specific document.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="document_type">Document Type *</Label>
            <select
              id="document_type"
              value={formData.document_type}
              onChange={(e) =>
                setFormData({ ...formData, document_type: e.target.value as DocumentType })
              }
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              required
            >
              <option value="">Select document type...</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Request Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Current passport copy"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide additional details or requirements..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Request
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
