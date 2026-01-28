'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Users, MoreHorizontal, UserMinus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useRemoveMember, useUpdateMember } from '@/hooks/use-firm-members';
import type { FirmMember, FirmRole } from '@/types/firms';

interface MemberListProps {
  firmId: string;
  members: FirmMember[];
  currentUserRole: FirmRole;
  currentUserId: string;
}

const ROLE_BADGE_COLORS: Record<FirmRole, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  attorney: 'bg-green-100 text-green-700',
  staff: 'bg-slate-100 text-slate-700',
};

const ROLE_LABELS: Record<FirmRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  attorney: 'Attorney',
  staff: 'Staff',
};

export function MemberList({ firmId, members, currentUserRole, currentUserId }: MemberListProps) {
  const [selectedMember, setSelectedMember] = useState<FirmMember | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const removeMember = useRemoveMember();
  const updateMember = useUpdateMember();

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  const handleRemoveMember = () => {
    if (!selectedMember) return;

    removeMember.mutate(
      { firmId, userId: selectedMember.userId },
      {
        onSuccess: () => {
          toast.success('Member removed successfully');
          setShowRemoveDialog(false);
          setSelectedMember(null);
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to remove member');
        },
      }
    );
  };

  const handleChangeRole = (member: FirmMember, newRole: FirmRole) => {
    updateMember.mutate(
      { firmId, input: { userId: member.userId, role: newRole } },
      {
        onSuccess: () => {
          toast.success('Member role updated');
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to update role');
        },
      }
    );
  };

  const getMemberName = (member: FirmMember) => {
    if (member.user?.firstName || member.user?.lastName) {
      return `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim();
    }
    return member.user?.email || 'Unknown';
  };

  const getMemberInitials = (member: FirmMember) => {
    if (member.user?.firstName || member.user?.lastName) {
      return `${member.user.firstName?.[0] || ''}${member.user.lastName?.[0] || ''}`.toUpperCase();
    }
    return member.user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>{members.length} member(s) in your firm</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No members yet</p>
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.user?.avatarUrl || undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getMemberInitials(member)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{getMemberName(member)}</p>
                      <p className="text-xs text-slate-500">{member.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={ROLE_BADGE_COLORS[member.role]}>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                    {canManage && member.userId !== currentUserId && member.role !== 'owner' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(member, 'admin')}
                            disabled={member.role === 'admin'}
                          >
                            <Shield size={14} className="mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(member, 'attorney')}
                            disabled={member.role === 'attorney'}
                          >
                            <Shield size={14} className="mr-2" />
                            Make Attorney
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(member, 'staff')}
                            disabled={member.role === 'staff'}
                          >
                            <Shield size={14} className="mr-2" />
                            Make Staff
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedMember(member);
                              setShowRemoveDialog(true);
                            }}
                          >
                            <UserMinus size={14} className="mr-2" />
                            Remove from Firm
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {member.userId === currentUserId && (
                      <span className="text-xs text-slate-400">(You)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={showRemoveDialog}
        onOpenChange={setShowRemoveDialog}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${selectedMember ? getMemberName(selectedMember) : 'this member'} from your firm? They will lose access to all firm resources.`}
        confirmLabel="Remove Member"
        onConfirm={handleRemoveMember}
        isLoading={removeMember.isPending}
        variant="destructive"
      />
    </>
  );
}
