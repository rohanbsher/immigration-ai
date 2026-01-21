'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  MoreVertical,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useDocuments, useDeleteDocument, useVerifyDocument, useAnalyzeDocument } from '@/hooks/use-documents';
import { formatFileSize } from '@/lib/storage/utils';
import { toast } from 'sonner';
import type { DocumentStatus, DocumentType } from '@/types';

const statusConfig: Record<DocumentStatus, { label: string; className: string }> = {
  uploaded: { label: 'Uploaded', className: 'bg-slate-100 text-slate-700' },
  processing: { label: 'Processing', className: 'bg-yellow-100 text-yellow-700' },
  analyzed: { label: 'Analyzed', className: 'bg-blue-100 text-blue-700' },
  needs_review: { label: 'Needs Review', className: 'bg-amber-100 text-amber-700' },
  verified: { label: 'Verified', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  expired: { label: 'Expired', className: 'bg-orange-100 text-orange-700' },
};

const typeLabels: Record<DocumentType, string> = {
  passport: 'Passport',
  visa: 'Visa',
  i94: 'I-94',
  birth_certificate: 'Birth Certificate',
  marriage_certificate: 'Marriage Certificate',
  divorce_certificate: 'Divorce Certificate',
  employment_letter: 'Employment Letter',
  pay_stub: 'Pay Stub',
  tax_return: 'Tax Return',
  w2: 'W-2',
  bank_statement: 'Bank Statement',
  photo: 'Photo',
  medical_exam: 'Medical Exam',
  police_clearance: 'Police Clearance',
  diploma: 'Diploma',
  transcript: 'Transcript',
  recommendation_letter: 'Recommendation Letter',
  other: 'Other',
};

interface DocumentListProps {
  caseId: string;
}

export function DocumentList({ caseId }: DocumentListProps) {
  const { data: documents, isLoading } = useDocuments(caseId);
  const { mutate: deleteDocument, isPending: isDeleting } = useDeleteDocument();
  const { mutate: verifyDocument, isPending: isVerifying } = useVerifyDocument();
  const { mutate: analyzeDocument, isPending: isAnalyzing } = useAnalyzeDocument();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteClick = (id: string, name: string) => {
    setDocumentToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!documentToDelete) return;

    deleteDocument(documentToDelete.id, {
      onSuccess: () => {
        toast.success('Document deleted');
        setDeleteDialogOpen(false);
        setDocumentToDelete(null);
      },
      onError: (error) => {
        toast.error(error.message);
        setDeleteDialogOpen(false);
        setDocumentToDelete(null);
      },
    });
  };

  const handleVerify = (id: string) => {
    verifyDocument(id, {
      onSuccess: () => toast.success('Document verified'),
      onError: (error) => toast.error(error.message),
    });
  };

  const handleAnalyze = (id: string) => {
    analyzeDocument(id, {
      onSuccess: () => toast.success('Document analysis started'),
      onError: (error) => toast.error(error.message),
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-600">No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const statusInfo = statusConfig[doc.status as DocumentStatus] || statusConfig.uploaded;

        return (
          <Card key={doc.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{doc.file_name}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{typeLabels[doc.document_type as DocumentType] || doc.document_type}</span>
                      <span>-</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      {doc.ai_confidence_score && (
                        <>
                          <span>-</span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {Math.round(doc.ai_confidence_score * 100)}% confidence
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={statusInfo.className}>
                    {statusInfo.label}
                  </Badge>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${doc.file_name}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={doc.file_url} download={doc.file_name}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </a>
                      </DropdownMenuItem>
                      {(doc.status === 'uploaded' || doc.status === 'needs_review') && (
                        <DropdownMenuItem
                          onClick={() => handleAnalyze(doc.id)}
                          disabled={isAnalyzing}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          {doc.status === 'needs_review' ? 'Re-analyze with AI' : 'Analyze with AI'}
                        </DropdownMenuItem>
                      )}
                      {(doc.status === 'analyzed' || doc.status === 'needs_review') && (
                        <DropdownMenuItem
                          onClick={() => handleVerify(doc.id)}
                          disabled={isVerifying}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Verify
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(doc.id, doc.file_name)}
                        disabled={isDeleting}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Document"
        description={`Are you sure you want to delete "${documentToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDocumentToDelete(null)}
        isLoading={isDeleting}
        variant="destructive"
      />
    </div>
  );
}
