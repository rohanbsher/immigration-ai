'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, AlertCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useInvitation, useAcceptInvitation } from '@/hooks/use-firm-members';
import type { FirmRole } from '@/types/firms';

const ROLE_LABELS: Record<FirmRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  attorney: 'Attorney',
  staff: 'Staff',
};

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const { data: invitation, isLoading, error } = useInvitation(token);
  const acceptInvitation = useAcceptInvitation();

  const handleAccept = () => {
    acceptInvitation.mutate(token, {
      onSuccess: () => {
        toast.success('You have joined the firm!');
        router.push('/dashboard/firm');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to accept invitation');
      },
    });
  };

  const handleDecline = () => {
    router.push('/dashboard');
    toast.info('Invitation declined');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired. Please contact the firm administrator
              for a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(invitation.expiresAt) < new Date();
  const inviterName = invitation.inviter?.firstName
    ? `${invitation.inviter.firstName} ${invitation.inviter.lastName || ''}`.trim()
    : invitation.inviter?.email;

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation to join {invitation.firm.name} has expired. Please contact the firm
              administrator for a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Join {invitation.firm.name}</CardTitle>
          <CardDescription>
            {inviterName} has invited you to join their firm on Immigration AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Firm</span>
              <span className="font-medium">{invitation.firm.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Your Role</span>
              <Badge variant="outline">{ROLE_LABELS[invitation.role]}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Invited By</span>
              <span className="font-medium">{inviterName}</span>
            </div>
          </div>

          {/* Role Description */}
          <div className="text-sm text-slate-600">
            {invitation.role === 'admin' && (
              <p>As an Administrator, you&apos;ll be able to manage team members and firm settings.</p>
            )}
            {invitation.role === 'attorney' && (
              <p>As an Attorney, you&apos;ll be able to manage cases and access all firm resources.</p>
            )}
            {invitation.role === 'staff' && (
              <p>As Staff, you&apos;ll be able to view and work on assigned cases.</p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleAccept}
              className="w-full"
              disabled={acceptInvitation.isPending}
            >
              {acceptInvitation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Accept Invitation
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDecline}
              className="w-full"
              disabled={acceptInvitation.isPending}
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
