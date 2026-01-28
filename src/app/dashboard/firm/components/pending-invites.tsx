'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Mail, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRevokeInvitation } from '@/hooks/use-firm-members';
import type { FirmInvitation, FirmRole } from '@/types/firms';

interface PendingInvitesProps {
  firmId: string;
  invitations: FirmInvitation[];
}

const ROLE_LABELS: Record<FirmRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  attorney: 'Attorney',
  staff: 'Staff',
};

export function PendingInvites({ firmId, invitations }: PendingInvitesProps) {
  const revokeInvitation = useRevokeInvitation();

  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending');

  const handleRevoke = (invitationId: string) => {
    revokeInvitation.mutate(
      { firmId, invitationId },
      {
        onSuccess: () => {
          toast.success('Invitation revoked');
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to revoke invitation');
        },
      }
    );
  };

  const formatExpiry = (expiresAt: string) => {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return 'Expires tomorrow';
    return `Expires in ${diffDays} days`;
  };

  if (pendingInvitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Pending Invitations
        </CardTitle>
        <CardDescription>
          {pendingInvitations.length} pending invitation(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {pendingInvitations.map((invitation) => (
            <div key={invitation.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">{invitation.email}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={12} />
                    <span>{formatExpiry(invitation.expiresAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{ROLE_LABELS[invitation.role]}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-red-600"
                  onClick={() => handleRevoke(invitation.id)}
                  disabled={revokeInvitation.isPending}
                >
                  {revokeInvitation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <X size={16} />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
