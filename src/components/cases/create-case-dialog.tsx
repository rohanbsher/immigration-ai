'use client';

import { useState, useEffect, useRef } from 'react';
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
import dynamic from 'next/dynamic';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { FieldHelp } from '@/components/workflow/contextual-help';
import { useCreateCase } from '@/hooks/use-cases';
import { useSearchClients } from '@/hooks/use-clients';
import { useQuota } from '@/hooks/use-quota';

const UpgradePromptDialog = dynamic(
  () => import('@/components/billing/upgrade-prompt').then(m => ({ default: m.UpgradePromptDialog })),
  { ssr: false }
);
const UpgradePromptBanner = dynamic(
  () => import('@/components/billing/upgrade-prompt').then(m => ({ default: m.UpgradePromptBanner })),
  { ssr: false }
);
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
  const { data: caseQuota } = useQuota('cases');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    visa_type: '' as VisaType | '',
    description: '',
    deadline: '',
  });

  // Client search state
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isLoading: isSearching } = useSearchClients(debouncedSearch);

  // Reset form error when dialog opens
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormError(null);
  }, [open]);

  // Debounce the search input by 300ms (only when dialog is open)
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(clientSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, open]);

  // Close dropdown on outside click (only when dialog is open)
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleClientSelect = (client: { id: string; first_name: string; last_name: string; email: string }) => {
    const name = `${client.first_name} ${client.last_name}`;
    setSelectedClient({ id: client.id, name, email: client.email });
    setFormData((prev) => ({ ...prev, client_id: client.id }));
    setClientSearch('');
    setIsDropdownOpen(false);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setFormData((prev) => ({ ...prev, client_id: '' }));
    setClientSearch('');
    setDebouncedSearch('');
  };

  const isAtLimit = caseQuota && !caseQuota.isUnlimited && !caseQuota.allowed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isAtLimit) {
      setShowUpgradeDialog(true);
      return;
    }

    if (!formData.title || !formData.client_id || !formData.visa_type) {
      setFormError('Please fill in all required fields');
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
          if (error.message?.includes('quota') || error.message?.includes('limit')) {
            setShowUpgradeDialog(true);
          } else {
            setFormError(error.message || 'Failed to create case. Please try again.');
          }
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

        {caseQuota && (
          <UpgradePromptBanner metric="cases" quota={caseQuota} className="mt-2" />
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="title">
                Case Title <span className="text-destructive">*</span>
              </Label>
              <FieldHelp
                title="Case Title"
                description="A descriptive name for this case that helps you identify it quickly. Include the client name or visa type for easy reference."
                example="Smith Family - I-485 Adjustment of Status"
              />
            </div>
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
            <Label htmlFor="client_search">
              Client <span className="text-destructive">*</span>
            </Label>

            {selectedClient ? (
              <div className="flex items-center justify-between rounded-md border border-input bg-muted/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {selectedClient.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedClient.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearClient}
                  disabled={isPending}
                  className="ml-2 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-muted-foreground disabled:opacity-50"
                  aria-label="Clear client selection"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <Input
                  id="client_search"
                  placeholder="Search by name or email..."
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    if (e.target.value.length >= 2 && !selectedClient) setIsDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (debouncedSearch.length >= 2) setIsDropdownOpen(true);
                  }}
                  disabled={isPending}
                  autoComplete="off"
                />

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                      </div>
                    ) : searchResults && searchResults.length > 0 ? (
                      searchResults.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                          onClick={() => handleClientSelect(client)}
                        >
                          <p className="text-sm font-medium text-foreground">
                            {client.first_name} {client.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                        </button>
                      ))
                    ) : debouncedSearch.length >= 2 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        No clients found for &ldquo;{debouncedSearch}&rdquo;
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {!selectedClient && (
              <p className="text-xs text-muted-foreground">
                Type at least 2 characters to search
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="visa_type">
                Visa Type <span className="text-destructive">*</span>
              </Label>
              <FieldHelp
                title="Visa Type"
                description="Select the immigration form or visa category for this case. This determines the required documents and AI recommendations."
                example="H-1B for employment-based, I-485 for green card adjustment"
              />
            </div>
            <Select
              value={formData.visa_type || undefined}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, visa_type: value as VisaType }))
              }
              disabled={isPending}
            >
              <SelectTrigger id="visa_type" className="w-full">
                <SelectValue placeholder="Select visa type..." />
              </SelectTrigger>
              <SelectContent>
                {visaTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="flex items-center gap-1">
              <Label htmlFor="deadline">Deadline</Label>
              <FieldHelp
                title="Case Deadline"
                description="Set a filing deadline or target date for this case. You will receive reminders as the deadline approaches."
              />
            </div>
            <Input
              id="deadline"
              name="deadline"
              type="date"
              value={formData.deadline}
              onChange={handleInputChange}
              disabled={isPending}
            />
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

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

      {caseQuota && (
        <UpgradePromptDialog
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          metric="cases"
          quota={caseQuota}
        />
      )}
    </Dialog>
  );
}
