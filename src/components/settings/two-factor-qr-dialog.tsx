'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TwoFactorQrDialogProps {
  open: boolean;
  qrCodeDataUrl: string | null;
  onClose: () => void;
  onContinue: () => void;
}

export function TwoFactorQrDialog({
  open,
  qrCodeDataUrl,
  onClose,
  onContinue,
}: TwoFactorQrDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Up Authenticator App</DialogTitle>
          <DialogDescription>
            Scan this QR code with your authenticator app (like Google Authenticator, Authy, or
            1Password).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {qrCodeDataUrl && (
            <Image
              src={qrCodeDataUrl}
              alt="2FA QR Code"
              width={192}
              height={192}
              className="border rounded-lg"
              unoptimized
            />
          )}
          <p className="text-sm text-muted-foreground text-center">
            After scanning, your app will display a 6-digit code. Click Continue to enter it.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onContinue}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
