import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoFactorBackupDialog } from './two-factor-backup-dialog';

describe('TwoFactorBackupDialog', () => {
  const defaultProps = {
    open: true,
    backupCodes: ['AAAA1111', 'BBBB2222', 'CCCC3333', 'DDDD4444'],
    copiedCodes: false,
    onCopy: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders dialog title and description when open', () => {
    render(<TwoFactorBackupDialog {...defaultProps} />);
    expect(screen.getByText('Save Your Backup Codes')).toBeInTheDocument();
    expect(
      screen.getByText('Save these backup codes in a secure location. Each code can only be used once.')
    ).toBeInTheDocument();
  });

  test('renders warning alert about authenticator app', () => {
    render(<TwoFactorBackupDialog {...defaultProps} />);
    expect(
      screen.getByText('If you lose access to your authenticator app, you can use these codes to sign in.')
    ).toBeInTheDocument();
  });

  test('renders all backup codes', () => {
    render(<TwoFactorBackupDialog {...defaultProps} />);
    for (const code of defaultProps.backupCodes) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });

  test('renders Copy All Codes button when codes not copied', () => {
    render(<TwoFactorBackupDialog {...defaultProps} copiedCodes={false} />);
    expect(screen.getByText('Copy All Codes')).toBeInTheDocument();
  });

  test('renders Copied! button text when codes have been copied', () => {
    render(<TwoFactorBackupDialog {...defaultProps} copiedCodes={true} />);
    expect(screen.getByText('Copied!')).toBeInTheDocument();
    expect(screen.queryByText('Copy All Codes')).not.toBeInTheDocument();
  });

  test('calls onCopy when copy button is clicked', () => {
    render(<TwoFactorBackupDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Copy All Codes'));
    expect(defaultProps.onCopy).toHaveBeenCalledTimes(1);
  });

  test('renders Done button in footer', () => {
    render(<TwoFactorBackupDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  test('calls onClose when Done button is clicked', () => {
    render(<TwoFactorBackupDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('does not render dialog content when open is false', () => {
    render(<TwoFactorBackupDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Save Your Backup Codes')).not.toBeInTheDocument();
  });

  test('renders empty grid when no backup codes are provided', () => {
    render(<TwoFactorBackupDialog {...defaultProps} backupCodes={[]} />);
    expect(screen.getByText('Save Your Backup Codes')).toBeInTheDocument();
    expect(screen.queryByText('AAAA1111')).not.toBeInTheDocument();
  });

  test('renders many backup codes in grid', () => {
    const manyCodes = [
      'CODE0001', 'CODE0002', 'CODE0003', 'CODE0004',
      'CODE0005', 'CODE0006', 'CODE0007', 'CODE0008',
    ];
    render(<TwoFactorBackupDialog {...defaultProps} backupCodes={manyCodes} />);
    for (const code of manyCodes) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });
});
