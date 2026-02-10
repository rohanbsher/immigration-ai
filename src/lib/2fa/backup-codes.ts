/**
 * Backup Code Generation & Verification
 *
 * Security: 128 bits entropy (NIST SP 800-63B recommends 112+ bits)
 *
 * Backward Compatibility:
 * - Old 8-char codes (pre-Feb 2024) still verify correctly
 * - Hash comparison is length-agnostic
 * - Users do NOT need to regenerate unless they choose to
 */
import crypto from 'crypto';

const BACKUP_CODE_BYTES = 16; // 128 bits of entropy (NIST SP 800-63B compliant)
const BACKUP_CODE_COUNT = 10;

export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = crypto
      .randomBytes(BACKUP_CODE_BYTES)
      .toString('hex')
      .toUpperCase();
    codes.push(code);
  }

  return codes;
}

export function hashBackupCode(code: string): string {
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(normalizedCode).digest('hex');
}

export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(hashBackupCode);
}

export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const codeHash = hashBackupCode(code);
  const codeHashBuffer = Buffer.from(codeHash, 'hex');
  let found = false;

  for (const storedHash of hashedCodes) {
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (
      codeHashBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(codeHashBuffer, storedBuffer)
    ) {
      found = true;
    }
  }

  return found;
}

export function formatBackupCode(code: string): string {
  // Format 32-char code as 8 groups of 4: A1B2-C3D4-E5F6-G7H8-I9J0-K1L2-M3N4-O5P6
  const chunks: string[] = [];
  for (let i = 0; i < code.length; i += 4) {
    chunks.push(code.slice(i, i + 4));
  }
  return chunks.join('-');
}

export function parseBackupCode(formattedCode: string): string {
  return formattedCode.replace(/-/g, '').toUpperCase();
}
