'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { TwoFactorVerificationInput } from './two-factor-verification-input';

interface TwoFactorRegenerateDialogProps {
  open: boolean;
  verificationCode: string;
  onCodeChange: (value: string) => void;
  error: string | null;
  onErrorClear: () => void;
  isSubmitting: boolean;
  onRegenerate: () => void;
  onClose: () => void;
}

export function TwoFactorRegenerateDialog({
  open,
  verificationCode,
  onCodeChange,
  error,
  onErrorClear,
  isSubmitting,
  onRegenerate,
  onClose,
}: TwoFactorRegenerateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Regenerate Backup Codes</DialogTitle>
          <DialogDescription>
            Enter a verification code to generate new backup codes. Your old codes will be
            invalidated.
          </DialogDescription>
        </DialogHeader>
        <TwoFactorVerificationInput
          id="regenerate-code"
          value={verificationCode}
          onChange={onCodeChange}
          error={error}
          onErrorClear={onErrorClear}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onRegenerate}
            disabled={isSubmitting || verificationCode.length < 6}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate New Codes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
