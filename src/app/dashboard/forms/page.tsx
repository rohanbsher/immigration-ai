'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Plus,
  Loader2,
  Clock,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { useCases } from '@/hooks/use-cases';
import { useCreateForm } from '@/hooks/use-forms';
import { getFormSummaries } from '@/lib/forms/definitions';
import { FormsEmptyState } from '@/components/ui/empty-state';
import { Skeleton, FormCardSkeleton, ListSkeleton } from '@/components/ui/skeletons';
import { toast } from 'sonner';
import type { FormType } from '@/types';

const formSummaries = getFormSummaries();


export default function FormsPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedFormType, setSelectedFormType] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const { data: casesData, isLoading: casesLoading } = useCases({}, { limit: 100 });
  const { mutate: createForm, isPending: isCreating } = useCreateForm();

  const handleCreateForm = () => {
    if (!selectedFormType || !selectedCaseId) {
      toast.error('Please select a form type and case');
      return;
    }

    createForm(
      { case_id: selectedCaseId, form_type: selectedFormType as FormType },
      {
        onSuccess: (data) => {
          toast.success('Form created successfully');
          setCreateDialogOpen(false);
          setSelectedFormType(null);
          setSelectedCaseId(null);
          router.push(`/dashboard/forms/${data.id}`);
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create form');
        },
      }
    );
  };

  if (casesLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        {/* Form templates skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg border">
                  <div className="flex items-center gap-3 mb-2">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full mb-3" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Forms by case skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <ListSkeleton count={3} ItemSkeleton={FormCardSkeleton} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Forms</h1>
          <p className="text-muted-foreground">Create and manage USCIS forms</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
          <Plus size={18} />
          New Form
        </Button>
      </div>

      {/* Form Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Available Form Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {formSummaries.map((form) => (
              <div
                key={form.formType}
                className="p-4 rounded-lg border hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedFormType(form.formType);
                  setCreateDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="text-primary" size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{form.formType}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{form.title}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {form.estimatedTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {form.estimatedTime}
                    </span>
                  )}
                  {form.filingFee && (
                    <span className="flex items-center gap-1">
                      <DollarSign size={12} />${form.filingFee}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Forms by Case */}
      <Card>
        <CardHeader>
          <CardTitle>Forms by Case</CardTitle>
        </CardHeader>
        <CardContent>
          {casesData?.cases && casesData.cases.length > 0 ? (
            <div className="space-y-4">
              {casesData.cases.map((caseItem) => (
                <div key={caseItem.id} className="p-4 rounded-lg border hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Link
                        href={`/dashboard/cases/${caseItem.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {caseItem.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {caseItem.client.first_name} {caseItem.client.last_name} -{' '}
                        {caseItem.visa_type}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCaseId(caseItem.id);
                        setCreateDialogOpen(true);
                      }}
                    >
                      <Plus size={14} className="mr-1" />
                      Add Form
                    </Button>
                  </div>
                  {caseItem.forms_count > 0 ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{caseItem.forms_count} forms</Badge>
                      <Link
                        href={`/dashboard/cases/${caseItem.id}?tab=forms`}
                        className="text-sm text-primary hover:underline"
                      >
                        View all
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No forms created yet</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <FormsEmptyState onCreateForm={() => setCreateDialogOpen(true)} />
          )}
        </CardContent>
      </Card>

      {/* AI Features */}
      <Card className="bg-gradient-to-r from-ai-accent-muted/50 to-primary/5 border-ai-accent/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-ai-accent-muted flex items-center justify-center flex-shrink-0">
              <Sparkles className="text-ai-accent" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">AI-Powered Form Filling</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Upload documents and let our AI automatically extract information to fill out your
                immigration forms. Supports passports, birth certificates, employment letters, and
                more.
              </p>
              <div className="flex gap-2">
                <Badge className="bg-ai-accent-muted text-ai-accent border-ai-accent/20">
                  GPT-4 Vision for OCR
                </Badge>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  Claude for Reasoning
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Form Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
            <DialogDescription>
              Select a form type and the case to associate it with.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Form Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {formSummaries.map((form) => (
                  <div
                    key={form.formType}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedFormType === form.formType
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-border'
                    }`}
                    onClick={() => setSelectedFormType(form.formType)}
                  >
                    <p className="font-medium">{form.formType}</p>
                    <p className="text-xs text-muted-foreground truncate">{form.title}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Case</Label>
              {casesData?.cases && casesData.cases.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {casesData.cases.map((caseItem) => (
                    <div
                      key={caseItem.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCaseId === caseItem.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-border'
                      }`}
                      onClick={() => setSelectedCaseId(caseItem.id)}
                    >
                      <p className="font-medium">{caseItem.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {caseItem.client.first_name} {caseItem.client.last_name}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No cases available. Create a case first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateForm}
              disabled={!selectedFormType || !selectedCaseId || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Form'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
