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
import { Loader2, X } from 'lucide-react';
import { useCreateCase } from '@/hooks/use-cases';
import { useSearchClients } from '@/hooks/use-clients';
import { useQuota } from '@/hooks/use-quota';
import { UpgradePromptDialog, UpgradePromptBanner } from '@/components/billing/upgrade-prompt';
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

  // Debounce the search input by 300ms (only when dialog is open)
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(clientSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, open]);

  // Open dropdown when search results arrive
  useEffect(() => {
    if (debouncedSearch.length >= 2 && !selectedClient) {
      setIsDropdownOpen(true);
    }
  }, [debouncedSearch, searchResults, selectedClient]);

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

    if (isAtLimit) {
      setShowUpgradeDialog(true);
      return;
    }

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
          if (error.message?.includes('quota') || error.message?.includes('limit')) {
            setShowUpgradeDialog(true);
          } else {
            toast.error(error.message || 'Failed to create case');
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
            <Label htmlFor="client_search">
              Client <span className="text-red-500">*</span>
            </Label>

            {selectedClient ? (
              <div className="flex items-center justify-between rounded-md border border-input bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {selectedClient.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {selectedClient.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearClient}
                  disabled={isPending}
                  className="ml-2 shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50"
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
                  onChange={(e) => setClientSearch(e.target.value)}
                  onFocus={() => {
                    if (debouncedSearch.length >= 2) setIsDropdownOpen(true);
                  }}
                  disabled={isPending}
                  autoComplete="off"
                />

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="ml-2 text-sm text-slate-500">Searching...</span>
                      </div>
                    ) : searchResults && searchResults.length > 0 ? (
                      searchResults.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                          onClick={() => handleClientSelect(client)}
                        >
                          <p className="text-sm font-medium text-slate-900">
                            {client.first_name} {client.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{client.email}</p>
                        </button>
                      ))
                    ) : debouncedSearch.length >= 2 ? (
                      <div className="px-3 py-4 text-center text-sm text-slate-500">
                        No clients found for &ldquo;{debouncedSearch}&rdquo;
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {!selectedClient && (
              <p className="text-xs text-slate-500">
                Type at least 2 characters to search
              </p>
            )}
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
