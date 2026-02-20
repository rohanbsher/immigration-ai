import * as OTPAuth from 'otpauth';
import { randomBytes } from 'crypto';

const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const DEFAULT_ISSUER = 'CaseFill';

export function generateSecret(): string {
  // Generate a 20-byte random secret (160 bits, as per RFC 4226)
  const buffer = randomBytes(20);
  // Convert to base32 encoding
  return base32Encode(buffer);
}

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}

export function generateTOTP(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: DEFAULT_ISSUER,
    label: 'User',
    algorithm: 'SHA1',
    digits: DEFAULT_DIGITS,
    period: DEFAULT_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.generate();
}

export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: DEFAULT_ISSUER,
      label: 'User',
      algorithm: 'SHA1',
      digits: DEFAULT_DIGITS,
      period: DEFAULT_PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Validate returns delta (time steps difference) or null if invalid
    // Using window of 1 allows for 1 time step drift in either direction
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

export function getKeyUri(
  secret: string,
  accountName: string,
  issuer = DEFAULT_ISSUER
): string {
  const totp = new OTPAuth.TOTP({
    issuer,
    label: accountName,
    algorithm: 'SHA1',
    digits: DEFAULT_DIGITS,
    period: DEFAULT_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.toString();
}

export function getRemainingSeconds(): number {
  const now = Math.floor(Date.now() / 1000);
  return DEFAULT_PERIOD - (now % DEFAULT_PERIOD);
}
