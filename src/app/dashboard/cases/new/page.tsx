'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { useSearchClients, useCreateClient } from '@/hooks/use-clients';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { useQuota } from '@/hooks/use-quota';
import { UpgradePromptBanner, UpgradePromptDialog } from '@/components/billing/upgrade-prompt';
import { toast } from 'sonner';
import type { VisaType } from '@/types';

import { StepIndicator } from './step-indicator';
import { ClientStep } from './client-step';
import { VisaStep } from './visa-step';
import { DetailsStep } from './details-step';
import { ReviewStep } from './review-step';

type Step = 'client' | 'visa' | 'details' | 'review';

const STEPS = [
  { id: 'client', label: 'Client', icon: User },
  { id: 'visa', label: 'Visa Type', icon: FileText },
  { id: 'details', label: 'Details', icon: FolderOpen },
  { id: 'review', label: 'Review', icon: Check },
];

export default function NewCasePage() {
  const router = useRouter();
  const { mutate: createCase, isPending } = useCreateCase();
  const { mutateAsync: createClient, isPending: isCreatingClient } = useCreateClient();

  const { isLoading: isAuthLoading, hasAccess } = useRoleGuard({
    requiredRoles: ['attorney', 'admin'],
  });

  const { data: caseQuota, isLoading: isQuotaLoading } = useQuota('cases');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const [step, setStep] = useState<Step>('client');
  const [clientSearch, setClientSearch] = useState('');
  const { data: searchResults, isLoading: isSearching } = useSearchClients(clientSearch);

  const [formData, setFormData] = useState({
    client_id: '',
    client_first_name: '',
    client_last_name: '',
    client_email: '',
    is_new_client: true,
    visa_type: '' as VisaType | '',
    title: '',
    description: '',
    priority_date: '',
    deadline: '',
    notes: '',
  });

  if (isAuthLoading || !hasAccess || isQuotaLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isAtLimit = caseQuota && !caseQuota.isUnlimited && !caseQuota.allowed;
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const handleClientSelect = (clientId: string, clientName: string) => {
    setFormData((prev) => ({
      ...prev,
      client_id: clientId,
      is_new_client: false,
      title: `${formData.visa_type || 'Immigration'} Application - ${clientName}`,
    }));
  };

  const handleClientFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      is_new_client: true,
      client_id: '',
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

  const handleDetailsFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (isAtLimit) {
      setShowUpgradeDialog(true);
      return;
    }

    if (!formData.visa_type || !formData.title) {
      toast.error('Please complete all required fields');
      return;
    }

    let clientId = formData.client_id;

    if (formData.is_new_client && !clientId) {
      if (!formData.client_email || !formData.client_first_name || !formData.client_last_name) {
        toast.error('Please provide client name and email');
        return;
      }

      try {
        const newClient = await createClient({
          email: formData.client_email,
          first_name: formData.client_first_name,
          last_name: formData.client_last_name,
        });
        clientId = newClient.id;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to create client');
        return;
      }
    }

    if (!clientId) {
      toast.error('Please select or create a client');
      return;
    }

    createCase(
      {
        client_id: clientId,
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
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex].id as Step);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].id as Step);
    } else {
      router.back();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {caseQuota && (
        <UpgradePromptDialog
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          metric="cases"
          quota={caseQuota}
        />
      )}

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

      <StepIndicator steps={STEPS} currentStepId={step} />

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {step === 'client' && (
            <ClientStep
              clientSearch={clientSearch}
              onSearchChange={setClientSearch}
              isSearching={isSearching}
              searchResults={searchResults}
              selectedClientId={formData.client_id}
              onClientSelect={handleClientSelect}
              clientFirstName={formData.client_first_name}
              clientLastName={formData.client_last_name}
              clientEmail={formData.client_email}
              onFieldChange={handleClientFieldChange}
            />
          )}

          {step === 'visa' && (
            <VisaStep
              selectedVisaType={formData.visa_type}
              onVisaSelect={handleVisaSelect}
            />
          )}

          {step === 'details' && (
            <DetailsStep
              title={formData.title}
              description={formData.description}
              priorityDate={formData.priority_date}
              deadline={formData.deadline}
              notes={formData.notes}
              onFieldChange={handleDetailsFieldChange}
            />
          )}

          {step === 'review' && (
            <ReviewStep
              isNewClient={formData.is_new_client}
              clientFirstName={formData.client_first_name}
              clientLastName={formData.client_last_name}
              clientEmail={formData.client_email}
              visaType={formData.visa_type}
              title={formData.title}
              deadline={formData.deadline}
              priorityDate={formData.priority_date}
              description={formData.description}
            />
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
          <Button onClick={handleSubmit} disabled={isPending || isCreatingClient}>
            {isPending || isCreatingClient ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isCreatingClient ? 'Creating Client...' : 'Creating Case...'}
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
