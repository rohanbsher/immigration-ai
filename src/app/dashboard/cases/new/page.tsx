'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  User,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { useCreateCase } from '@/hooks/use-cases';
import { useSearchClients } from '@/hooks/use-clients';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { useQuota } from '@/hooks/use-quota';
import { UpgradePromptBanner, UpgradePromptDialog } from '@/components/billing/upgrade-prompt';
import { toast } from 'sonner';
import type { VisaType } from '@/types';

const VISA_TYPES: { value: VisaType; label: string; description: string }[] = [
  {
    value: 'I-130',
    label: 'I-130',
    description: 'Petition for Alien Relative - Sponsor a family member',
  },
  {
    value: 'I-485',
    label: 'I-485',
    description: 'Adjustment of Status - Apply for Green Card while in the U.S.',
  },
  {
    value: 'I-765',
    label: 'I-765',
    description: 'Employment Authorization Document (EAD)',
  },
  {
    value: 'I-131',
    label: 'I-131',
    description: 'Travel Document (Advance Parole)',
  },
  {
    value: 'N-400',
    label: 'N-400',
    description: 'Application for Naturalization - U.S. Citizenship',
  },
  {
    value: 'H1B',
    label: 'H-1B',
    description: 'Specialty Occupation Worker',
  },
  {
    value: 'L1',
    label: 'L-1',
    description: 'Intracompany Transferee',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other immigration matter',
  },
];

type Step = 'client' | 'visa' | 'details' | 'review';

export default function NewCasePage() {
  const router = useRouter();
  const { mutate: createCase, isPending } = useCreateCase();

  // Protect this page - only attorneys and admins can create cases
  const { isLoading: isAuthLoading, hasAccess } = useRoleGuard({
    requiredRoles: ['attorney', 'admin'],
  });

  // Check case quota
  const { data: caseQuota, isLoading: isQuotaLoading } = useQuota('cases');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const [step, setStep] = useState<Step>('client');
  const [clientSearch, setClientSearch] = useState('');
  const { data: searchResults, isLoading: isSearching } = useSearchClients(clientSearch);

  // Form state - must be declared before any early returns to satisfy Rules of Hooks
  const [formData, setFormData] = useState({
    // Client info (for new client)
    client_id: '',
    client_first_name: '',
    client_last_name: '',
    client_email: '',
    is_new_client: true,
    // Case info
    visa_type: '' as VisaType | '',
    title: '',
    description: '',
    priority_date: '',
    deadline: '',
    notes: '',
  });

  // If still checking access or redirecting, show loading
  if (isAuthLoading || !hasAccess || isQuotaLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Check if user has reached their case limit
  const isAtLimit = caseQuota && !caseQuota.isUnlimited && !caseQuota.allowed;

  const handleClientSelect = (clientId: string, clientName: string) => {
    setFormData((prev) => ({
      ...prev,
      client_id: clientId,
      is_new_client: false,
      title: `${formData.visa_type || 'Immigration'} Application - ${clientName}`,
    }));
  };

  const handleVisaSelect = (visaType: VisaType) => {
    const clientName = formData.is_new_client
      ? `${formData.client_first_name} ${formData.client_last_name}`
      : 'Client';

    setFormData((prev) => ({
      ...prev,
      visa_type: visaType,
      title: `${visaType} Application - ${clientName}`,
    }));
  };

  const handleSubmit = async () => {
    // Check quota before creating
    if (isAtLimit) {
      setShowUpgradeDialog(true);
      return;
    }

    if (!formData.visa_type || !formData.title) {
      toast.error('Please complete all required fields');
      return;
    }

    // For now, we need an existing client
    // In a full implementation, we'd create the client first if it's a new one
    if (!formData.client_id) {
      toast.error('Please select an existing client');
      return;
    }

    createCase(
      {
        client_id: formData.client_id,
        visa_type: formData.visa_type,
        title: formData.title,
        description: formData.description || undefined,
        priority_date: formData.priority_date || undefined,
        deadline: formData.deadline || undefined,
        notes: formData.notes || undefined,
      },
      {
        onSuccess: (data) => {
          toast.success('Case created successfully');
          router.push(`/dashboard/cases/${data.id}`);
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create case');
        },
      }
    );
  };

  const steps = [
    { id: 'client', label: 'Client', icon: User },
    { id: 'visa', label: 'Visa Type', icon: FileText },
    { id: 'details', label: 'Details', icon: FolderOpen },
    { id: 'review', label: 'Review', icon: Check },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  const canProceed = () => {
    switch (step) {
      case 'client':
        return formData.client_id || (formData.client_first_name && formData.client_email);
      case 'visa':
        return !!formData.visa_type;
      case 'details':
        return !!formData.title;
      default:
        return true;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex].id as Step);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex].id as Step);
    } else {
      router.back();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Upgrade Prompt Dialog */}
      {caseQuota && (
        <UpgradePromptDialog
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          metric="cases"
          quota={caseQuota}
        />
      )}

      {/* Quota Warning Banner */}
      {caseQuota && !caseQuota.isUnlimited && (
        <UpgradePromptBanner metric="cases" quota={caseQuota} />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New Case</h1>
          <p className="text-slate-600">Set up a new immigration case</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((s, index) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = currentStepIndex > index;

          return (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 ${
                  isActive
                    ? 'text-blue-600'
                    : isCompleted
                    ? 'text-green-600'
                    : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-blue-100'
                      : isCompleted
                      ? 'bg-green-100'
                      : 'bg-slate-100'
                  }`}
                >
                  {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                </div>
                <span className="hidden sm:block font-medium">{s.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 sm:w-24 h-1 mx-2 rounded ${
                    isCompleted ? 'bg-green-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {step === 'client' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Select or Add Client</h2>
                <p className="text-slate-600">
                  Choose an existing client or add a new one for this case.
                </p>
              </div>

              {/* Search Existing Clients */}
              <div className="space-y-4">
                <Label>Search Existing Clients</Label>
                <Input
                  placeholder="Search by name or email..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                {isSearching && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                )}
                {searchResults && searchResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {searchResults.map((client) => (
                      <div
                        key={client.id}
                        className={`p-3 cursor-pointer hover:bg-slate-50 ${
                          formData.client_id === client.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() =>
                          handleClientSelect(
                            client.id,
                            `${client.first_name} ${client.last_name}`
                          )
                        }
                      >
                        <p className="font-medium">
                          {client.first_name} {client.last_name}
                        </p>
                        <p className="text-sm text-slate-500">{client.email}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or add new client</span>
                </div>
              </div>

              {/* New Client Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={formData.client_first_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          client_first_name: e.target.value,
                          is_new_client: true,
                          client_id: '',
                        }))
                      }
                      disabled={!!formData.client_id}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={formData.client_last_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          client_last_name: e.target.value,
                          is_new_client: true,
                          client_id: '',
                        }))
                      }
                      disabled={!!formData.client_id}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.client_email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        client_email: e.target.value,
                        is_new_client: true,
                        client_id: '',
                      }))
                    }
                    disabled={!!formData.client_id}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 'visa' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Select Visa Type</h2>
                <p className="text-slate-600">
                  Choose the type of immigration application for this case.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {VISA_TYPES.map((visa) => (
                  <div
                    key={visa.value}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      formData.visa_type === visa.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => handleVisaSelect(visa.value)}
                  >
                    <p className="font-semibold text-slate-900">{visa.label}</p>
                    <p className="text-sm text-slate-600 mt-1">{visa.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Case Details</h2>
                <p className="text-slate-600">
                  Provide additional information about this case.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Case Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g., I-130 Application - John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
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
                      value={formData.priority_date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, priority_date: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, deadline: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Internal Notes</Label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Review Case</h2>
                <p className="text-slate-600">
                  Review the case details before creating.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-50">
                  <h3 className="font-medium text-slate-700 mb-2">Client</h3>
                  <p className="text-slate-900">
                    {formData.is_new_client
                      ? `${formData.client_first_name} ${formData.client_last_name}`
                      : 'Existing client selected'}
                  </p>
                  {formData.client_email && (
                    <p className="text-sm text-slate-600">{formData.client_email}</p>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-slate-50">
                  <h3 className="font-medium text-slate-700 mb-2">Case Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Visa Type</p>
                      <p className="font-medium">{formData.visa_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Title</p>
                      <p className="font-medium">{formData.title}</p>
                    </div>
                    {formData.deadline && (
                      <div>
                        <p className="text-sm text-slate-500">Deadline</p>
                        <p className="font-medium">
                          {new Date(formData.deadline).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {formData.priority_date && (
                      <div>
                        <p className="text-sm text-slate-500">Priority Date</p>
                        <p className="font-medium">
                          {new Date(formData.priority_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  {formData.description && (
                    <div className="mt-4">
                      <p className="text-sm text-slate-500">Description</p>
                      <p className="text-slate-900">{formData.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {step === 'review' ? (
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Create Case
              </>
            )}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
