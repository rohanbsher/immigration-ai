'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Plus, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useFirms, useCreateFirm, useFirm } from '@/hooks/use-firm';
import { useFirmMembers, useFirmInvitations } from '@/hooks/use-firm-members';
import { useUser } from '@/hooks/use-user';
import { FirmSettings } from './components/firm-settings';
import { MemberList } from './components/member-list';
import { InviteModal } from './components/invite-modal';
import { PendingInvites } from './components/pending-invites';
import type { FirmRole } from '@/types/firms';

function CreateFirmCard() {
  const [firmName, setFirmName] = useState('');
  const createFirm = useCreateFirm();

  const handleCreate = () => {
    if (!firmName.trim()) {
      toast.error('Please enter a firm name');
      return;
    }

    createFirm.mutate(
      { name: firmName.trim() },
      {
        onSuccess: () => {
          toast.success('Firm created successfully');
          setFirmName('');
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create firm');
        },
      }
    );
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Create Your Firm</CardTitle>
        <CardDescription>
          Set up your law firm to start collaborating with your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="firm-name">Firm Name</Label>
          <Input
            id="firm-name"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Smith & Associates Law Firm"
          />
        </div>
        <Button onClick={handleCreate} className="w-full" disabled={createFirm.isPending}>
          {createFirm.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Create Firm
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function FirmDashboard({ firmId, userRole }: { firmId: string; userRole: FirmRole }) {
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data: firm, isLoading: firmLoading } = useFirm(firmId);
  const { data: members = [], isLoading: membersLoading } = useFirmMembers(firmId);
  const { data: invitations = [], isLoading: invitationsLoading } = useFirmInvitations(firmId);
  const { profile } = useUser();

  const canManageMembers = userRole === 'owner' || userRole === 'admin';

  if (firmLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load firm information</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Firm Settings</h1>
          <p className="text-slate-600">Manage your firm and team members</p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Firm Settings */}
      <FirmSettings firm={firm} />

      {/* Team Members */}
      <MemberList
        firmId={firmId}
        members={members}
        currentUserRole={userRole}
        currentUserId={profile?.id || ''}
      />

      {/* Pending Invitations */}
      {canManageMembers && !invitationsLoading && (
        <PendingInvites firmId={firmId} invitations={invitations} />
      )}

      {/* Invite Modal */}
      <InviteModal
        firmId={firmId}
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
      />
    </div>
  );
}

export default function FirmPage() {
  const { data: firms, isLoading } = useFirms();
  const { profile } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // If user has no firms, show create firm card
  if (!firms || firms.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Firm Management</h1>
          <p className="text-slate-600">Create or join a firm to collaborate with your team</p>
        </div>
        <CreateFirmCard />
      </div>
    );
  }

  // For now, show the first firm (in future could have firm switcher)
  const primaryFirm = firms[0];

  // Determine user's role in the firm
  // This would typically come from the API, but for now we'll assume owner if they're the owner
  const userRole: FirmRole = primaryFirm.ownerId === profile?.id ? 'owner' : 'attorney';

  return <FirmDashboard firmId={primaryFirm.id} userRole={userRole} />;
}
