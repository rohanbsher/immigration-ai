import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoFactorDisableDialog } from './two-factor-disable-dialog';

describe('TwoFactorDisableDialog', () => {
  const defaultProps = {
    open: true,
    verificationCode: '',
    onCodeChange: vi.fn(),
    error: null as string | null,
    onErrorClear: vi.fn(),
    isSubmitting: false,
    onDisable: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders dialog title and description when open', () => {
    render(<TwoFactorDisableDialog {...defaultProps} />);
    expect(screen.getByText('Disable Two-Factor Authentication')).toBeInTheDocument();
    expect(
      screen.getByText('Enter a verification code from your authenticator app to confirm.')
    ).toBeInTheDocument();
  });

  test('renders destructive warning alert', () => {
    render(<TwoFactorDisableDialog {...defaultProps} />);
    expect(
      screen.getByText('Disabling 2FA will make your account less secure.')
    ).toBeInTheDocument();
  });

  test('renders verification code input', () => {
    render(<TwoFactorDisableDialog {...defaultProps} />);
    expect(screen.getByLabelText('Verification Code')).toBeInTheDocument();
  });

  test('renders help text about backup codes', () => {
    render(<TwoFactorDisableDialog {...defaultProps} />);
    expect(screen.getByText('You can also use a backup code.')).toBeInTheDocument();
  });

  test('renders Cancel button that calls onClose', () => {
    render(<TwoFactorDisableDialog {...defaultProps} />);
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('renders Disable 2FA button', () => {
    render(<TwoFactorDisableDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Disable 2FA' })).toBeInTheDocument();
  });

  test('Disable 2FA button is disabled when code is shorter than 6 characters', () => {
    render(<TwoFactorDisableDialog {...defaultProps} verificationCode="123" />);
    expect(screen.getByRole('button', { name: 'Disable 2FA' })).toBeDisabled();
  });

  test('Disable 2FA button is enabled when code has 6 characters', () => {
    render(<TwoFactorDisableDialog {...defaultProps} verificationCode="123456" />);
    expect(screen.getByRole('button', { name: 'Disable 2FA' })).toBeEnabled();
  });

  test('Disable 2FA button is enabled with 8-char backup code', () => {
    render(<TwoFactorDisableDialog {...defaultProps} verificationCode="12345678" />);
    expect(screen.getByRole('button', { name: 'Disable 2FA' })).toBeEnabled();
  });

  test('Disable 2FA button is disabled when isSubmitting', () => {
    render(
      <TwoFactorDisableDialog
        {...defaultProps}
        verificationCode="123456"
        isSubmitting={true}
      />
    );
    expect(screen.getByRole('button', { name: 'Disable 2FA' })).toBeDisabled();
  });

  test('calls onDisable when Disable 2FA button is clicked', () => {
    render(
      <TwoFactorDisableDialog {...defaultProps} verificationCode="123456" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disable 2FA' }));
    expect(defaultProps.onDisable).toHaveBeenCalledTimes(1);
  });

  test('shows error message when error prop is set', () => {
    render(
      <TwoFactorDisableDialog {...defaultProps} error="Invalid verification code" />
    );
    expect(screen.getByText('Invalid verification code')).toBeInTheDocument();
  });

  test('does not render dialog when open is false', () => {
    render(<TwoFactorDisableDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Disable Two-Factor Authentication')).not.toBeInTheDocument();
  });

  test('calls onCodeChange when input value changes', () => {
    render(<TwoFactorDisableDialog {...defaultProps} />);
    const input = screen.getByLabelText('Verification Code');
    fireEvent.change(input, { target: { value: '123' } });
    expect(defaultProps.onCodeChange).toHaveBeenCalled();
    expect(defaultProps.onErrorClear).toHaveBeenCalled();
  });
});
