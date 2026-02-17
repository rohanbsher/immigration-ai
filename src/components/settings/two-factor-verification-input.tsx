'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TwoFactorVerificationInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  onErrorClear: () => void;
  maxLength?: number;
  helpText?: string;
}

export function TwoFactorVerificationInput({
  id,
  value,
  onChange,
  error,
  onErrorClear,
  maxLength = 6,
  helpText,
}: TwoFactorVerificationInputProps) {
  return (
    <div className="py-4 space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor={id}>Verification Code</Label>
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={maxLength}
          placeholder="000000"
          value={value}
          onChange={(e) => {
            const filtered = e.target.value.replace(/\D/g, '').slice(0, maxLength);
            onChange(filtered);
            onErrorClear();
          }}
          className="text-center text-2xl tracking-widest"
          autoFocus
        />
        {helpText && (
          <p className="text-xs text-muted-foreground">{helpText}</p>
        )}
      </div>
    </div>
  );
}
