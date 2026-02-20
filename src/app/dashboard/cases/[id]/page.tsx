'use client';

import { use, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CaseStatusBadge } from '@/components/cases';
import { DocumentUpload } from '@/components/documents/document-upload';
import { DocumentList } from '@/components/documents/document-list';
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  Edit,
  Loader2,
  Upload,
  Plus,
} from 'lucide-react';
import { useCase, useUpdateCase } from '@/hooks/use-cases';
import { useForms, useCreateForm } from '@/hooks/use-forms';
import { toast } from 'sonner';
import { DocumentCompletenessPanel } from '@/components/ai/document-completeness-panel';
import { SuccessScoreBreakdown } from '@/components/ai/success-score-breakdown';
import { NextStepsPanel } from '@/components/ai/next-steps-panel';
import { RFERiskPanel } from '@/components/ai/rfe-risk-panel';
import { CaseChatButton } from '@/components/chat/chat-button';
import { CaseMessagesPanel } from '@/components/messaging';
import { TaskList } from '@/components/tasks';
import { ActivityTimeline } from '@/components/cases/activity-timeline';
import { EditCaseDialog } from './edit-case-dialog';
import { statusOptions, formTypeOptions } from './constants';
import { Breadcrumbs, generateCaseBreadcrumbs } from '@/components/ui/breadcrumbs';
import type { CaseStatus, FormType } from '@/types';

function CaseDetailContent({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'overview';

  const { data: caseData, isLoading, error } = useCase(id);
  const { data: forms, isLoading: formsLoading } = useForms(id);
  const { mutate: updateCase, isPending: isUpdating } = useUpdateCase();
  const { mutate: createForm, isPending: isCreatingForm } = useCreateForm();

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isCreateFormDialogOpen, setIsCreateFormDialogOpen] = useState(false);
  const [selectedFormType, setSelectedFormType] = useState<FormType | ''>('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleStatusChange = (newStatus: CaseStatus) => {
    updateCase(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast.success('Case status updated');
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to update status');
        },
      }
    );
  };

  const handleDocumentUploadSuccess = () => {
    setIsUploadDialogOpen(false);
    toast.success('Documents uploaded successfully');
  };

  const handleCreateForm = () => {
    if (!selectedFormType) {
      toast.error('Please select a form type');
      return;
    }

    createForm(
      { case_id: id, form_type: selectedFormType },
      {
        onSuccess: (newForm) => {
          toast.success(`Form ${selectedFormType} created`);
          setIsCreateFormDialogOpen(false);
          setSelectedFormType('');
          router.push(`/dashboard/forms/${newForm.id}`);
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create form');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Case not found or you don&apos;t have access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientName = `${caseData.client.first_name} ${caseData.client.last_name}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={generateCaseBreadcrumbs(id, caseData.title)} />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back to previous page">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl tracking-tight text-foreground">{caseData.title}</h1>
            <CaseStatusBadge status={caseData.status} />
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User size={14} />
              {clientName}
            </span>
            <Badge variant="outline">{caseData.visa_type}</Badge>
            {caseData.deadline && (
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                Due {new Date(caseData.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CaseChatButton caseId={id} />
          <select
            value={caseData.status}
            onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}
            disabled={isUpdating}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="icon" aria-label="Edit case details" onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({caseData.documents_count})
          </TabsTrigger>
          <TabsTrigger value="forms">Forms ({caseData.forms_count})</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* AI Success Score Breakdown */}
          <SuccessScoreBreakdown caseId={id} variant="compact" />

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column: Case Details + Client Info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Case Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Visa Type</p>
                    <p className="font-medium">{caseData.visa_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <CaseStatusBadge status={caseData.status} />
                  </div>
                  {caseData.priority_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Priority Date</p>
                      <p className="font-medium">
                        {new Date(caseData.priority_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {caseData.deadline && (
                    <div>
                      <p className="text-sm text-muted-foreground">Deadline</p>
                      <p className="font-medium">
                        {new Date(caseData.deadline).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {new Date(caseData.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Client Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{caseData.client.email}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: AI Panels */}
            <div className="space-y-6">
              <RFERiskPanel caseId={id} variant="full" />
              <DocumentCompletenessPanel
                caseId={id}
                variant="full"
                onUploadClick={() => setIsUploadDialogOpen(true)}
              />
              <NextStepsPanel caseId={id} variant="full" maxItems={5} />
            </div>
          </div>

          {caseData.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{caseData.description}</p>
              </CardContent>
            </Card>
          )}

          {caseData.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{caseData.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Documents</h3>
            <Button className="gap-2" onClick={() => setIsUploadDialogOpen(true)}>
              <Upload size={16} />
              Upload Document
            </Button>
          </div>
          <DocumentList caseId={id} />
        </TabsContent>

        <TabsContent value="forms" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Forms</h3>
            <Button className="gap-2" onClick={() => setIsCreateFormDialogOpen(true)}>
              <Plus size={16} />
              Create Form
            </Button>
          </div>

          {formsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : forms && forms.length > 0 ? (
            <div className="grid gap-4">
              {forms.map((form) => (
                <Card
                  key={form.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => router.push(`/dashboard/forms/${form.id}`)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-ai-accent" />
                      <div>
                        <p className="font-medium">Form {form.form_type}</p>
                        <p className="text-sm text-muted-foreground">
                          Created {new Date(form.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        form.status === 'approved'
                          ? 'bg-success/10 text-success'
                          : form.status === 'ai_filled'
                          ? 'bg-ai-accent-muted text-ai-accent'
                          : form.status === 'filed'
                          ? 'bg-info/10 text-info'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {form.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">No forms created yet.</p>
                <Button className="mt-4 gap-2" onClick={() => setIsCreateFormDialogOpen(true)}>
                  <Plus size={16} />
                  Create First Form
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <CaseMessagesPanel caseId={id} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <TaskList caseId={id} showCase={false} />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ActivityTimeline caseId={id} />
        </TabsContent>
      </Tabs>

      {/* Document Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Upload documents for this case. Supported formats: PDF, Images, Word documents.
            </DialogDescription>
          </DialogHeader>
          <DocumentUpload caseId={id} onSuccess={handleDocumentUploadSuccess} />
        </DialogContent>
      </Dialog>

      {/* Create Form Dialog */}
      <Dialog open={isCreateFormDialogOpen} onOpenChange={setIsCreateFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
            <DialogDescription>
              Select a form type to create for this case.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="form-type">Form Type</Label>
              <select
                id="form-type"
                value={selectedFormType}
                onChange={(e) => setSelectedFormType(e.target.value as FormType)}
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Select a form...</option>
                {formTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateFormDialogOpen(false);
                  setSelectedFormType('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateForm} disabled={!selectedFormType || isCreatingForm}>
                {isCreatingForm ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Form
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Case Dialog */}
      <EditCaseDialog
        caseId={id}
        caseData={caseData}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  );
}

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <CaseDetailContent id={id} />
    </Suspense>
  );
}
