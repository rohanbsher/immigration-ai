'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  useDocumentRequests,
  useMarkRequestAsFulfilled,
  useDeleteDocumentRequest,
  type DocumentRequest,
  type DocumentRequestStatus,
} from '@/hooks/use-document-requests';
import { CreateDocumentRequestDialog } from './create-document-request-dialog';
import { useCanPerform } from '@/hooks/use-role-guard';
import {
  Plus,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DocumentRequestListProps {
  caseId: string;
  className?: string;
}

const STATUS_CONFIG: Record<
  DocumentRequestStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-warning/10 text-warning' },
  uploaded: { label: 'Uploaded', icon: FileText, className: 'bg-info/10 text-info' },
  fulfilled: { label: 'Fulfilled', icon: CheckCircle, className: 'bg-success/10 text-success' },
  expired: { label: 'Expired', icon: AlertCircle, className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, className: 'bg-muted text-muted-foreground' },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', className: 'bg-primary/10 text-primary' },
  high: { label: 'High', className: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
};

function RequestCard({
  request,
  caseId,
  isAttorney,
}: {
  request: DocumentRequest;
  caseId: string;
  isAttorney: boolean;
}) {
  const { mutate: markFulfilled, isPending: isMarkingFulfilled } = useMarkRequestAsFulfilled(caseId);
  const { mutate: deleteRequest, isPending: isDeleting } = useDeleteDocumentRequest(caseId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const statusConfig = STATUS_CONFIG[request.status];
  const StatusIcon = statusConfig.icon;
  const priorityConfig = PRIORITY_CONFIG[request.priority];

  const handleMarkFulfilled = () => {
    markFulfilled(request.id, {
      onSuccess: () => toast.success('Request marked as fulfilled'),
      onError: (error) => toast.error(error.message || 'Failed to update request'),
    });
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteRequest(request.id, {
      onSuccess: () => {
        toast.success('Request deleted');
        setDeleteDialogOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to delete request');
        setDeleteDialogOpen(false);
      },
    });
  };

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{request.title}</h4>
            <Badge variant="outline" className="text-xs">
              {request.document_type.replace('_', ' ')}
            </Badge>
          </div>
          {request.description && (
            <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn('gap-1', statusConfig.className)}>
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
          {request.priority !== 'normal' && (
            <Badge className={cn('text-xs', priorityConfig.className)}>
              {priorityConfig.label}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Requested {format(new Date(request.created_at), 'MMM d, yyyy')}</span>
          {request.due_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Due {format(new Date(request.due_date), 'MMM d, yyyy')}
            </span>
          )}
        </div>

        {isAttorney && (
          <div className="flex items-center gap-2">
            {request.status === 'uploaded' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkFulfilled}
                disabled={isMarkingFulfilled}
              >
                {isMarkingFulfilled ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark Fulfilled
                  </>
                )}
              </Button>
            )}
            {request.status === 'pending' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {request.fulfilled_document && (
        <div className="pt-2 border-t">
          <p className="text-sm">
            <span className="text-muted-foreground">Fulfilled with:</span>{' '}
            <a
              href={request.fulfilled_document.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {request.fulfilled_document.file_name}
            </a>
          </p>
        </div>
      )}

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Request"
        description={`Are you sure you want to delete the request "${request.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        variant="destructive"
      />
    </div>
  );
}

export function DocumentRequestList({ caseId, className }: DocumentRequestListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: requests, isLoading, error } = useDocumentRequests(caseId);
  const canCreateRequest = useCanPerform(['attorney', 'admin']);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive/40 mx-auto mb-4" />
          <p className="text-muted-foreground">Failed to load document requests</p>
        </CardContent>
      </Card>
    );
  }

  const pendingRequests = requests?.filter((r) => r.status === 'pending') || [];
  const otherRequests = requests?.filter((r) => r.status !== 'pending') || [];

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Document Requests
        </CardTitle>
        {canCreateRequest && (
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Request Document
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">No document requests yet</p>
            {canCreateRequest && (
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create First Request
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {pendingRequests.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                  Pending Requests ({pendingRequests.length})
                </h4>
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      caseId={caseId}
                      isAttorney={canCreateRequest}
                    />
                  ))}
                </div>
              </div>
            )}

            {otherRequests.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                  Completed Requests ({otherRequests.length})
                </h4>
                <div className="space-y-3">
                  {otherRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      caseId={caseId}
                      isAttorney={canCreateRequest}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CreateDocumentRequestDialog
        caseId={caseId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </Card>
  );
}
