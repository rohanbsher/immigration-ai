'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Shield, Loader2, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

import dynamic from 'next/dynamic';

const TwoFactorQrDialog = dynamic(
  () => import('./two-factor-qr-dialog').then(m => ({ default: m.TwoFactorQrDialog })),
  { ssr: false }
);
const TwoFactorVerifyDialog = dynamic(
  () => import('./two-factor-verify-dialog').then(m => ({ default: m.TwoFactorVerifyDialog })),
  { ssr: false }
);
const TwoFactorBackupDialog = dynamic(
  () => import('./two-factor-backup-dialog').then(m => ({ default: m.TwoFactorBackupDialog })),
  { ssr: false }
);
const TwoFactorDisableDialog = dynamic(
  () => import('./two-factor-disable-dialog').then(m => ({ default: m.TwoFactorDisableDialog })),
  { ssr: false }
);
const TwoFactorRegenerateDialog = dynamic(
  () => import('./two-factor-regenerate-dialog').then(m => ({ default: m.TwoFactorRegenerateDialog })),
  { ssr: false }
);

const log = createLogger('two-factor-setup');

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
      const response = await fetchWithTimeout('/api/2fa/status', { timeout: 'STANDARD' });
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (err) {
      log.logError('Failed to fetch 2FA status', err);
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
      const response = await fetchWithTimeout('/api/2fa/setup', { method: 'POST', timeout: 'STANDARD' });
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
      const response = await fetchWithTimeout('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verificationCode,
          isSetup: step === 'verify',
        }),
        timeout: 'STANDARD',
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
      const response = await fetchWithTimeout('/api/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode }),
        timeout: 'STANDARD',
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
      const response = await fetchWithTimeout('/api/2fa/backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode }),
        timeout: 'STANDARD',
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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              <div className="flex items-center gap-2 text-success">
                <Check size={20} />
                <span className="font-medium">Two-factor authentication is enabled</span>
              </div>
              {status.lastUsedAt && (
                <p className="text-sm text-muted-foreground">
                  Last used: {new Date(status.lastUsedAt).toLocaleDateString()}
                </p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Backup codes remaining: {status.backupCodesRemaining}
                </span>
                {status.backupCodesRemaining < 3 && (
                  <AlertTriangle className="h-4 w-4 text-warning" />
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
                <p className="text-sm text-muted-foreground">
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
      <TwoFactorQrDialog
        open={step === 'qr-code'}
        qrCodeDataUrl={qrCodeDataUrl}
        onClose={handleClose}
        onContinue={() => setStep('verify')}
      />

      {/* Verification Dialog */}
      <TwoFactorVerifyDialog
        open={step === 'verify'}
        verificationCode={verificationCode}
        onCodeChange={setVerificationCode}
        error={error}
        onErrorClear={() => setError(null)}
        isSubmitting={isSubmitting}
        onVerify={handleVerify}
        onBack={() => setStep('qr-code')}
        onClose={handleClose}
      />

      {/* Backup Codes Dialog */}
      <TwoFactorBackupDialog
        open={step === 'backup-codes'}
        backupCodes={backupCodes}
        copiedCodes={copiedCodes}
        onCopy={handleCopyBackupCodes}
        onClose={handleClose}
      />

      {/* Disable 2FA Dialog */}
      <TwoFactorDisableDialog
        open={step === 'disable'}
        verificationCode={verificationCode}
        onCodeChange={setVerificationCode}
        error={error}
        onErrorClear={() => setError(null)}
        isSubmitting={isSubmitting}
        onDisable={handleDisable}
        onClose={handleClose}
      />

      {/* Regenerate Backup Codes Dialog */}
      <TwoFactorRegenerateDialog
        open={step === 'regenerate'}
        verificationCode={verificationCode}
        onCodeChange={setVerificationCode}
        error={error}
        onErrorClear={() => setError(null)}
        isSubmitting={isSubmitting}
        onRegenerate={handleRegenerateBackupCodes}
        onClose={handleClose}
      />
    </>
  );
}
