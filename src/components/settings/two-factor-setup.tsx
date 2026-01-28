'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, Check, Copy, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TwoFactorStatus {
  enabled: boolean;
  verified: boolean;
  lastUsedAt: string | null;
  backupCodesRemaining: number;
}

type SetupStep = 'idle' | 'qr-code' | 'verify' | 'backup-codes' | 'disable' | 'regenerate';

export function TwoFactorSetup() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<SetupStep>('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/2fa/status');
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleStartSetup = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/2fa/setup', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start 2FA setup');
      }

      setQrCodeDataUrl(data.data.qrCodeDataUrl);
      setBackupCodes(data.data.backupCodes);
      setStep('qr-code');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start setup';
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length < 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verificationCode,
          isSetup: step === 'verify',
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      if (step === 'verify') {
        setStep('backup-codes');
        toast.success('Two-factor authentication enabled!');
      } else if (step === 'disable') {
        toast.success('Two-factor authentication disabled');
        setStep('idle');
        await fetchStatus();
      } else if (step === 'regenerate') {
        toast.success('Backup codes regenerated');
        setStep('backup-codes');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
      setVerificationCode('');
    }
  };

  const handleDisable = async () => {
    if (verificationCode.length < 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable 2FA');
      }

      toast.success('Two-factor authentication disabled');
      setStep('idle');
      await fetchStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disable 2FA';
      setError(message);
    } finally {
      setIsSubmitting(false);
      setVerificationCode('');
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (verificationCode.length < 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/2fa/backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate backup codes');
      }

      setBackupCodes(data.data.backupCodes);
      setStep('backup-codes');
      setCopiedCodes(false);
      toast.success('New backup codes generated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to regenerate backup codes';
      setError(message);
    } finally {
      setIsSubmitting(false);
      setVerificationCode('');
    }
  };

  const handleCopyBackupCodes = async () => {
    const codesText = backupCodes.join('\n');
    await navigator.clipboard.writeText(codesText);
    setCopiedCodes(true);
    toast.success('Backup codes copied to clipboard');
  };

  const handleClose = () => {
    setStep('idle');
    setVerificationCode('');
    setError(null);
    setQrCodeDataUrl(null);
    setBackupCodes([]);
    setCopiedCodes(false);
    fetchStatus();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status?.enabled && status?.verified ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <Check size={20} />
                <span className="font-medium">Two-factor authentication is enabled</span>
              </div>
              {status.lastUsedAt && (
                <p className="text-sm text-slate-500">
                  Last used: {new Date(status.lastUsedAt).toLocaleDateString()}
                </p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  Backup codes remaining: {status.backupCodesRemaining}
                </span>
                {status.backupCodesRemaining < 3 && (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('regenerate');
                    setError(null);
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate Backup Codes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setStep('disable');
                    setError(null);
                  }}
                >
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Authenticator App</p>
                <p className="text-sm text-slate-500">
                  Use an authenticator app to generate one-time codes.
                </p>
              </div>
              <Button onClick={handleStartSetup} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Enable
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={step === 'qr-code'} onOpenChange={(open) => !open && handleClose()}>
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
              <img
                src={qrCodeDataUrl}
                alt="2FA QR Code"
                className="w-48 h-48 border rounded-lg"
              />
            )}
            <p className="text-sm text-slate-500 text-center">
              After scanning, your app will display a 6-digit code. Click Continue to enter it.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={() => setStep('verify')}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification Dialog */}
      <Dialog open={step === 'verify'} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Your Authenticator</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code from your authenticator app to complete setup.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCode(value);
                  setError(null);
                }}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep('qr-code')}>
              Back
            </Button>
            <Button onClick={handleVerify} disabled={isSubmitting || verificationCode.length < 6}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={step === 'backup-codes'} onOpenChange={(open) => !open && handleClose()}>
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
            <div className="bg-slate-100 rounded-lg p-4 font-mono text-sm">
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
              onClick={handleCopyBackupCodes}
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
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={step === 'disable'} onOpenChange={(open) => !open && handleClose()}>
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
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="disable-code">Verification Code</Label>
              <Input
                id="disable-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setVerificationCode(value);
                  setError(null);
                }}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
              <p className="text-xs text-slate-500">
                You can also use a backup code.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={isSubmitting || verificationCode.length < 6}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Backup Codes Dialog */}
      <Dialog open={step === 'regenerate'} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Backup Codes</DialogTitle>
            <DialogDescription>
              Enter a verification code to generate new backup codes. Your old codes will be
              invalidated.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="regenerate-code">Verification Code</Label>
              <Input
                id="regenerate-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCode(value);
                  setError(null);
                }}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleRegenerateBackupCodes}
              disabled={isSubmitting || verificationCode.length < 6}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate New Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
