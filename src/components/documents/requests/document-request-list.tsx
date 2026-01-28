'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  pending: { label: 'Pending', icon: Clock, className: 'bg-yellow-100 text-yellow-700' },
  uploaded: { label: 'Uploaded', icon: FileText, className: 'bg-blue-100 text-blue-700' },
  fulfilled: { label: 'Fulfilled', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
  expired: { label: 'Expired', icon: AlertCircle, className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, className: 'bg-gray-100 text-gray-700' },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-slate-100 text-slate-600' },
  normal: { label: 'Normal', className: 'bg-blue-100 text-blue-600' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-600' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-600' },
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

  const statusConfig = STATUS_CONFIG[request.status];
  const StatusIcon = statusConfig.icon;
  const priorityConfig = PRIORITY_CONFIG[request.priority];

  const handleMarkFulfilled = () => {
    markFulfilled(request.id, {
      onSuccess: () => toast.success('Request marked as fulfilled'),
      onError: (error) => toast.error(error.message || 'Failed to update request'),
    });
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this request?')) return;
    deleteRequest(request.id, {
      onSuccess: () => toast.success('Request deleted'),
      onError: (error) => toast.error(error.message || 'Failed to delete request'),
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
                onClick={handleDelete}
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
