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
import { AlertTriangle, Check, Copy } from 'lucide-react';

interface TwoFactorBackupDialogProps {
  open: boolean;
  backupCodes: string[];
  copiedCodes: boolean;
  onCopy: () => void;
  onClose: () => void;
}

export function TwoFactorBackupDialog({
  open,
  backupCodes,
  copiedCodes,
  onCopy,
  onClose,
}: TwoFactorBackupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Your Backup Codes</DialogTitle>
          <DialogDescription>
            Save these backup codes in a secure location. Each code can only be used once.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              If you lose access to your authenticator app, you can use these codes to sign in.
            </AlertDescription>
          </Alert>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <div key={index} className="text-center py-1 bg-white rounded border">
                  {code}
                </div>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={onCopy}
          >
            {copiedCodes ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy All Codes
              </>
            )}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
