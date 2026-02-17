'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useInviteMember } from '@/hooks/use-firm-members';
import type { FirmRole } from '@/types/firms';

interface InviteModalProps {
  firmId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_ROLES: { value: FirmRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Administrator', description: 'Can manage members and settings' },
  { value: 'attorney', label: 'Attorney', description: 'Can manage and view all cases' },
  { value: 'staff', label: 'Staff', description: 'Can view assigned cases only' },
];

export function InviteModal({ firmId, open, onOpenChange }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FirmRole>('attorney');

  const inviteMember = useInviteMember();

  const selectedRole = AVAILABLE_ROLES.find((r) => r.value === role);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    if (!email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    inviteMember.mutate(
      { firmId, input: { email: email.trim(), role } },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${email}`);
          setEmail('');
          setRole('attorney');
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to send invitation');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to add a new member to your firm.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@lawfirm.com"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>{selectedRole?.label || 'Select role'}</span>
                  <ChevronDown size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[calc(100%-2rem)]" align="start">
                {AVAILABLE_ROLES.map((r) => (
                  <DropdownMenuItem
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    className="flex flex-col items-start py-2"
                  >
                    <span className="font-medium">{r.label}</span>
                    <span className="text-xs text-muted-foreground">{r.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="text-xs text-muted-foreground">{selectedRole?.description}</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteMember.isPending}>
              {inviteMember.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
