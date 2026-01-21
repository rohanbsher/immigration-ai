import crypto from 'crypto';

const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_COUNT = 10;

export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = crypto
      .randomBytes(BACKUP_CODE_LENGTH / 2)
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
  return hashedCodes.includes(codeHash);
}

export function formatBackupCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function parseBackupCode(formattedCode: string): string {
  return formattedCode.replace(/-/g, '').toUpperCase();
}
