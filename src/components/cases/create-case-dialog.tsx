'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useCreateCase } from '@/hooks/use-cases';
import { toast } from 'sonner';
import type { VisaType } from '@/types';

const visaTypes: { value: VisaType; label: string }[] = [
  { value: 'I-130', label: 'I-130 - Petition for Alien Relative' },
  { value: 'I-485', label: 'I-485 - Adjustment of Status' },
  { value: 'I-765', label: 'I-765 - Employment Authorization' },
  { value: 'N-400', label: 'N-400 - Naturalization' },
  { value: 'H1B', label: 'H-1B - Specialty Occupation' },
  { value: 'EB1', label: 'EB-1 - Priority Workers' },
  { value: 'EB2', label: 'EB-2 - Advanced Degree' },
  { value: 'EB3', label: 'EB-3 - Skilled Workers' },
  { value: 'L1', label: 'L-1 - Intracompany Transfer' },
  { value: 'O1', label: 'O-1 - Extraordinary Ability' },
  { value: 'other', label: 'Other' },
];

interface CreateCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCaseDialog({ open, onOpenChange }: CreateCaseDialogProps) {
  const router = useRouter();
  const { mutate: createCase, isPending } = useCreateCase();
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    visa_type: '' as VisaType | '',
    description: '',
    deadline: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.client_id || !formData.visa_type) {
      toast.error('Please fill in all required fields');
      return;
    }

    createCase(
      {
        title: formData.title,
        client_id: formData.client_id,
        visa_type: formData.visa_type as VisaType,
        description: formData.description || undefined,
        deadline: formData.deadline || undefined,
      },
      {
        onSuccess: (newCase) => {
          toast.success('Case created successfully');
          onOpenChange(false);
          router.push(`/dashboard/cases/${newCase.id}`);
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create case');
        },
      }
    );
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Case</DialogTitle>
          <DialogDescription>
            Start a new immigration case for your client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Case Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g., Adjustment of Status Application"
              value={formData.title}
              onChange={handleInputChange}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_id">
              Client ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="client_id"
              name="client_id"
              placeholder="Enter client UUID"
              value={formData.client_id}
              onChange={handleInputChange}
              required
              disabled={isPending}
            />
            <p className="text-xs text-slate-500">
              Enter the client&apos;s user ID from the system
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visa_type">
              Visa Type <span className="text-red-500">*</span>
            </Label>
            <select
              id="visa_type"
              name="visa_type"
              value={formData.visa_type}
              onChange={handleInputChange}
              required
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            >
              <option value="">Select visa type...</option>
              {visaTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              placeholder="Additional details about the case..."
              value={formData.description}
              onChange={handleInputChange}
              disabled={isPending}
              rows={3}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              name="deadline"
              type="date"
              value={formData.deadline}
              onChange={handleInputChange}
              disabled={isPending}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
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
                'Create Case'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
