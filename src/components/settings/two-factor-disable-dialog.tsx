'use client';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { TwoFactorVerificationInput } from './two-factor-verification-input';

interface TwoFactorDisableDialogProps {
  open: boolean;
  verificationCode: string;
  onCodeChange: (value: string) => void;
  error: string | null;
  onErrorClear: () => void;
  isSubmitting: boolean;
  onDisable: () => void;
  onClose: () => void;
}

export function TwoFactorDisableDialog({
  open,
  verificationCode,
  onCodeChange,
  error,
  onErrorClear,
  isSubmitting,
  onDisable,
  onClose,
}: TwoFactorDisableDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Enter a verification code from your authenticator app to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Disabling 2FA will make your account less secure.
            </AlertDescription>
          </Alert>
          <TwoFactorVerificationInput
            id="disable-code"
            value={verificationCode}
            onChange={onCodeChange}
            error={error}
            onErrorClear={onErrorClear}
            maxLength={8}
            helpText="You can also use a backup code."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDisable}
            disabled={isSubmitting || verificationCode.length < 6}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Disable 2FA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
