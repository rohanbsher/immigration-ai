'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import {
  useExportJobs,
  useRequestExport,
  useDeletionRequest,
  useRequestDeletion,
  useCancelDeletion,
} from '@/hooks/use-gdpr';
import { toast } from 'sonner';

function ExportStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="secondary" className="bg-success/10 text-success">
          <CheckCircle2 size={12} className="mr-1" />
          Completed
        </Badge>
      );
    case 'processing':
    case 'pending':
      return (
        <Badge variant="secondary" className="bg-warning/10 text-warning">
          <Clock size={12} className="mr-1" />
          {status === 'processing' ? 'Processing' : 'Pending'}
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="secondary" className="bg-destructive/10 text-destructive">
          <XCircle size={12} className="mr-1" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

export function GdprDataManagement() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: exportJobs, isLoading: exportsLoading } = useExportJobs();
  const { mutate: requestExport, isPending: isExporting } = useRequestExport();
  const { data: deletionRequest, isLoading: deletionLoading } = useDeletionRequest();
  const { mutate: requestDeletion, isPending: isDeleting } = useRequestDeletion();
  const { mutate: cancelDeletion, isPending: isCancelling } = useCancelDeletion();

  const scheduledDate = deletionRequest ? formatDate(deletionRequest.scheduled_for) : null;
  const hasPendingDeletion = deletionRequest != null && scheduledDate != null;

  const handleRequestExport = () => {
    requestExport(undefined, {
      onSuccess: (data) => {
        toast.success('Data export completed');
        const blob = new Blob([JSON.stringify(data.exportData, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const handleRequestDeletion = () => {
    requestDeletion(undefined, {
      onSuccess: (data) => {
        setShowDeleteDialog(false);
        const formattedDate = formatDate(data.scheduledFor);
        toast.success(
          formattedDate
            ? `Account scheduled for deletion on ${formattedDate}`
            : 'Account scheduled for deletion'
        );
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const handleCancelDeletion = () => {
    cancelDeletion('User cancelled', {
      onSuccess: () => {
        toast.success('Deletion request cancelled');
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download size={20} />
            Data Export
          </CardTitle>
          <CardDescription>
            Download a copy of all your personal data stored in the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleRequestExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Export...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Request Data Export
              </>
            )}
          </Button>

          {exportsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : exportJobs && exportJobs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Export History</p>
              <div className="space-y-2">
                {exportJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-lg border text-sm"
                  >
                    <span className="text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </span>
                    <ExportStatusBadge status={job.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 size={20} />
            Account Deletion
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action has a 30-day grace
            period during which you can cancel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deletionLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : hasPendingDeletion ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Deletion Scheduled</p>
                  <p className="text-sm text-destructive">
                    Your account is scheduled for permanent deletion on{' '}
                    <strong>{scheduledDate}</strong>.
                    All your data will be permanently removed after this date.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleCancelDeletion}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Deletion Request'
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Request Account Deletion
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Deletion Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              Delete Your Account
            </DialogTitle>
            <DialogDescription>
              This action will schedule your account for permanent deletion. You will have 30 days
              to cancel this request before all your data is permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive space-y-2">
              <p className="font-medium">The following data will be deleted:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Your profile and account settings</li>
                <li>All cases and associated documents</li>
                <li>All forms and AI analysis results</li>
                <li>Messages and activity history</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRequestDeletion}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Deletion'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
