'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Search,
  Filter,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCases } from '@/hooks/use-cases';
import { useCreateForm, useForms } from '@/hooks/use-forms';
import { getFormSummaries } from '@/lib/forms/definitions';
import { toast } from 'sonner';
import type { FormStatus, FormType } from '@/types';

const formSummaries = getFormSummaries();

const statusColors: Record<FormStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  ai_filled: 'bg-purple-100 text-purple-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  filed: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function FormsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'review' | 'filed'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedFormType, setSelectedFormType] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const { data: casesData, isLoading: casesLoading } = useCases({}, { limit: 100 });
  const { mutate: createForm, isPending: isCreating } = useCreateForm();

  // Get all forms across all cases
  const allForms: Array<{
    form: { id: string; form_type: string; status: FormStatus; created_at: string };
    caseName: string;
    caseId: string;
  }> = [];

  if (casesData?.cases) {
    for (const caseItem of casesData.cases) {
      // We'd need to fetch forms for each case, but for now we'll use the case-level data
      // The actual implementation would use a dedicated "all forms" query
    }
  }

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
          // Navigate to the form editor
          window.location.href = `/dashboard/forms/${data.id}`;
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create form');
        },
      }
    );
  };

  if (casesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Forms</h1>
          <p className="text-slate-600">Create and manage USCIS forms</p>
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
                className="p-4 rounded-lg border hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedFormType(form.formType);
                  setCreateDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{form.formType}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{form.title}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
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
                <div key={caseItem.id} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Link
                        href={`/dashboard/cases/${caseItem.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600"
                      >
                        {caseItem.title}
                      </Link>
                      <p className="text-sm text-slate-500">
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
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View all
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No forms created yet</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600 mb-4">No cases yet. Create a case first.</p>
              <Link href="/dashboard/cases">
                <Button>Go to Cases</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Features */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="text-purple-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">AI-Powered Form Filling</h3>
              <p className="text-sm text-slate-600 mb-3">
                Upload documents and let our AI automatically extract information to fill out your
                immigration forms. Supports passports, birth certificates, employment letters, and
                more.
              </p>
              <div className="flex gap-2">
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                  GPT-4 Vision for OCR
                </Badge>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
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
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-slate-300'
                    }`}
                    onClick={() => setSelectedFormType(form.formType)}
                  >
                    <p className="font-medium">{form.formType}</p>
                    <p className="text-xs text-slate-500 truncate">{form.title}</p>
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
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:border-slate-300'
                      }`}
                      onClick={() => setSelectedCaseId(caseItem.id)}
                    >
                      <p className="font-medium">{caseItem.title}</p>
                      <p className="text-xs text-slate-500">
                        {caseItem.client.first_name} {caseItem.client.last_name}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
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
