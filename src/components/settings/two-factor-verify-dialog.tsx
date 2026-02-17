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

interface TwoFactorVerifyDialogProps {
  open: boolean;
  verificationCode: string;
  onCodeChange: (value: string) => void;
  error: string | null;
  onErrorClear: () => void;
  isSubmitting: boolean;
  onVerify: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function TwoFactorVerifyDialog({
  open,
  verificationCode,
  onCodeChange,
  error,
  onErrorClear,
  isSubmitting,
  onVerify,
  onBack,
  onClose,
}: TwoFactorVerifyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Your Authenticator</DialogTitle>
          <DialogDescription>
            Enter the 6-digit code from your authenticator app to complete setup.
          </DialogDescription>
        </DialogHeader>
        <TwoFactorVerificationInput
          id="verification-code"
          value={verificationCode}
          onChange={onCodeChange}
          error={error}
          onErrorClear={onErrorClear}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onVerify} disabled={isSubmitting || verificationCode.length < 6}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify & Enable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
