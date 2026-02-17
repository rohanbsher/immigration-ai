'use client';

import { use, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
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
import { CaseStatusBadge } from '@/components/cases';
import { DocumentUpload } from '@/components/documents/document-upload';
import { CaseTimeline } from '@/components/client/case-timeline';
import { DocumentChecklist } from '@/components/client/document-checklist';
import { CaseMessagesPanel } from '@/components/messaging';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Loader2,
  Upload,
  User,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { useCase } from '@/hooks/use-cases';
import { toast } from 'sonner';
import { format } from 'date-fns';

function ClientCaseDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: caseData, isLoading, error } = useCase(id);
  const [activeTab, setActiveTab] = useState('overview');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const handleDocumentUploadSuccess = () => {
    setIsUploadDialogOpen(false);
    toast.success('Documents uploaded successfully');
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

  const getStatusDescription = (status: string) => {
    const descriptions: Record<string, string> = {
      intake: 'Your case has been opened. We are gathering initial information.',
      document_collection: 'We need you to upload the required documents for your case.',
      document_review: 'Your attorney is reviewing the documents you submitted.',
      form_preparation: 'Your attorney is preparing the necessary immigration forms.',
      client_review: 'Please review the prepared forms and provide your approval.',
      ready_to_file: 'All documents are ready. Your case will be filed soon.',
      filed: 'Your application has been submitted to USCIS.',
      pending_response: 'Waiting for a response from USCIS.',
      approved: 'Your application has been approved.',
      denied: 'Unfortunately, your application was denied. Contact your attorney for next steps.',
      closed: 'This case has been closed.',
    };
    return descriptions[status] || 'Case status update';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/client')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl tracking-tight text-foreground">{caseData.title}</h1>
            <CaseStatusBadge status={caseData.status} />
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <Badge variant="outline">{caseData.visa_type}</Badge>
            {caseData.deadline && (
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                Due {format(new Date(caseData.deadline), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status Card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Current Status</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {getStatusDescription(caseData.status)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column: Case Info */}
            <div className="space-y-6">
              {/* Case Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Case Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Visa Type</p>
                    <p className="font-medium">{caseData.visa_type}</p>
                  </div>
                  {caseData.priority_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Priority Date</p>
                      <p className="font-medium">
                        {format(new Date(caseData.priority_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  {caseData.deadline && (
                    <div>
                      <p className="text-sm text-muted-foreground">Deadline</p>
                      <p className="font-medium">
                        {format(new Date(caseData.deadline), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Case Opened</p>
                    <p className="font-medium">
                      {format(new Date(caseData.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Attorney Info */}
              {caseData.attorney && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Your Attorney
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">
                        {caseData.attorney.first_name} {caseData.attorney.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{caseData.attorney.email}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Progress and Documents */}
            <div className="space-y-6">
              {/* Quick Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Progress Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {caseData.documents_count || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Documents</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {caseData.forms_count || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Forms</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Document Checklist */}
              <DocumentChecklist caseId={id} />
            </div>
          </div>

          {/* Description */}
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
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Your Documents</h3>
              <p className="text-sm text-muted-foreground">
                Upload documents requested by your attorney
              </p>
            </div>
            <Button className="gap-2" onClick={() => setIsUploadDialogOpen(true)}>
              <Upload size={16} />
              Upload Document
            </Button>
          </div>

          <DocumentChecklist caseId={id} />
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <CaseMessagesPanel caseId={id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Case Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <CaseTimeline caseId={id} currentStatus={caseData.status} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Upload documents requested by your attorney. Supported formats: PDF, Images, Word documents.
            </DialogDescription>
          </DialogHeader>
          <DocumentUpload caseId={id} onSuccess={handleDocumentUploadSuccess} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClientCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ClientCaseDetailContent id={id} />
    </Suspense>
  );
}
