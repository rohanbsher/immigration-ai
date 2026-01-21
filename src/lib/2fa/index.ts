import { createClient } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/lib/crypto';
import {
  generateSecret,
  verifyTOTP,
  getKeyUri,
} from './totp';
import { generateQRCodeDataURL } from './qr-code';
import {
  generateBackupCodes,
  hashBackupCodes,
  hashBackupCode,
  verifyBackupCode,
} from './backup-codes';

export { generateSecret, verifyTOTP, getKeyUri } from './totp';
export { generateQRCodeDataURL, generateQRCodeSVG } from './qr-code';
export {
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  formatBackupCode,
  parseBackupCode,
} from './backup-codes';

export interface TwoFactorSetup {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  verified: boolean;
  lastUsedAt: string | null;
  backupCodesRemaining: number;
}

export async function setupTwoFactor(
  userId: string,
  email: string
): Promise<TwoFactorSetup> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('two_factor_auth')
    .select('id, verified')
    .eq('user_id', userId)
    .single();

  if (existing?.verified) {
    throw new Error('Two-factor authentication is already enabled');
  }

  const secret = generateSecret();
  const encryptedSecret = encrypt(secret);
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = hashBackupCodes(backupCodes);
  const keyUri = getKeyUri(secret, email);
  const qrCodeDataUrl = await generateQRCodeDataURL(keyUri);

  if (existing) {
    const { error } = await supabase
      .from('two_factor_auth')
      .update({
        secret_encrypted: encryptedSecret,
        backup_codes_hash: hashedBackupCodes,
        verified: false,
        enabled: false,
      })
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to update 2FA setup: ${error.message}`);
  } else {
    const { error } = await supabase.from('two_factor_auth').insert({
      user_id: userId,
      secret_encrypted: encryptedSecret,
      backup_codes_hash: hashedBackupCodes,
      verified: false,
      enabled: false,
    });

    if (error) throw new Error(`Failed to create 2FA setup: ${error.message}`);
  }

  return {
    secret,
    qrCodeDataUrl,
    backupCodes,
  };
}

export async function verifyAndEnableTwoFactor(
  userId: string,
  token: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data: twoFactor, error: fetchError } = await supabase
    .from('two_factor_auth')
    .select('id, secret_encrypted, verified')
    .eq('user_id', userId)
    .single();

  if (fetchError || !twoFactor) {
    throw new Error('Two-factor authentication not set up');
  }

  if (twoFactor.verified) {
    throw new Error('Two-factor authentication already verified');
  }

  const secret = decrypt(twoFactor.secret_encrypted);
  const isValid = verifyTOTP(token, secret);

  if (!isValid) {
    await recordAttempt(userId, 'totp', false);
    return false;
  }

  const { error: updateError } = await supabase
    .from('two_factor_auth')
    .update({
      verified: true,
      enabled: true,
      last_used_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(`Failed to enable 2FA: ${updateError.message}`);
  }

  await recordAttempt(userId, 'totp', true);
  return true;
}

export async function verifyTwoFactorToken(
  userId: string,
  token: string
): Promise<boolean> {
  const supabase = await createClient();

  const failedAttempts = await getRecentFailedAttempts(userId);
  if (failedAttempts >= 5) {
    throw new Error('Too many failed attempts. Please try again later.');
  }

  const { data: twoFactor, error } = await supabase
    .from('two_factor_auth')
    .select('id, secret_encrypted, enabled, verified, backup_codes_hash')
    .eq('user_id', userId)
    .single();

  if (error || !twoFactor || !twoFactor.enabled || !twoFactor.verified) {
    return false;
  }

  const secret = decrypt(twoFactor.secret_encrypted);
  const isValid = verifyTOTP(token, secret);

  if (isValid) {
    await recordAttempt(userId, 'totp', true);
    await supabase
      .from('two_factor_auth')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId);
    return true;
  }

  const isBackupCode = verifyBackupCode(token, twoFactor.backup_codes_hash);
  if (isBackupCode) {
    const codeHash = hashBackupCode(token);

    const { data: usedCode } = await supabase
      .from('backup_code_usage')
      .select('id')
      .eq('two_factor_id', twoFactor.id)
      .eq('code_hash', codeHash)
      .single();

    if (usedCode) {
      await recordAttempt(userId, 'backup_code', false);
      return false;
    }

    await supabase.from('backup_code_usage').insert({
      two_factor_id: twoFactor.id,
      code_hash: codeHash,
    });

    await recordAttempt(userId, 'backup_code', true);
    return true;
  }

  await recordAttempt(userId, 'totp', false);
  return false;
}

export async function disableTwoFactor(
  userId: string,
  token: string
): Promise<boolean> {
  const isValid = await verifyTwoFactorToken(userId, token);
  if (!isValid) {
    return false;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('two_factor_auth')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to disable 2FA: ${error.message}`);
  }

  return true;
}

export async function regenerateBackupCodes(
  userId: string,
  token: string
): Promise<string[]> {
  const isValid = await verifyTwoFactorToken(userId, token);
  if (!isValid) {
    throw new Error('Invalid verification code');
  }

  const supabase = await createClient();
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = hashBackupCodes(backupCodes);

  const { data: twoFactor } = await supabase
    .from('two_factor_auth')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (twoFactor) {
    await supabase
      .from('backup_code_usage')
      .delete()
      .eq('two_factor_id', twoFactor.id);
  }

  const { error } = await supabase
    .from('two_factor_auth')
    .update({ backup_codes_hash: hashedBackupCodes })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to regenerate backup codes: ${error.message}`);
  }

  return backupCodes;
}

export async function getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const supabase = await createClient();

  const { data: twoFactor } = await supabase
    .from('two_factor_auth')
    .select('id, enabled, verified, last_used_at, backup_codes_hash')
    .eq('user_id', userId)
    .single();

  if (!twoFactor) {
    return {
      enabled: false,
      verified: false,
      lastUsedAt: null,
      backupCodesRemaining: 0,
    };
  }

  const { count: usedCodesCount } = await supabase
    .from('backup_code_usage')
    .select('*', { count: 'exact', head: true })
    .eq('two_factor_id', twoFactor.id);

  const totalCodes = twoFactor.backup_codes_hash?.length || 0;
  const usedCodes = usedCodesCount || 0;

  return {
    enabled: twoFactor.enabled,
    verified: twoFactor.verified,
    lastUsedAt: twoFactor.last_used_at,
    backupCodesRemaining: Math.max(0, totalCodes - usedCodes),
  };
}

export async function isTwoFactorRequired(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: twoFactor } = await supabase
    .from('two_factor_auth')
    .select('enabled, verified')
    .eq('user_id', userId)
    .single();

  return !!(twoFactor?.enabled && twoFactor?.verified);
}

async function recordAttempt(
  userId: string,
  attemptType: 'totp' | 'backup_code' | 'recovery',
  success: boolean
): Promise<void> {
  const supabase = await createClient();

  await supabase.rpc('record_2fa_attempt', {
    p_user_id: userId,
    p_attempt_type: attemptType,
    p_success: success,
  });
}

async function getRecentFailedAttempts(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data } = await supabase.rpc('get_recent_2fa_failures', {
    p_user_id: userId,
    p_minutes: 15,
  });

  return data || 0;
}
