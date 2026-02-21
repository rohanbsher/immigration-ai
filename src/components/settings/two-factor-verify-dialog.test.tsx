import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoFactorVerifyDialog } from './two-factor-verify-dialog';

describe('TwoFactorVerifyDialog', () => {
  const defaultProps = {
    open: true,
    verificationCode: '',
    onCodeChange: vi.fn(),
    error: null as string | null,
    onErrorClear: vi.fn(),
    isSubmitting: false,
    onVerify: vi.fn(),
    onBack: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders dialog title and description when open', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} />);
    expect(screen.getByText('Verify Your Authenticator')).toBeInTheDocument();
    expect(
      screen.getByText('Enter the 6-digit code from your authenticator app to complete setup.')
    ).toBeInTheDocument();
  });

  test('renders verification code input', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} />);
    expect(screen.getByLabelText('Verification Code')).toBeInTheDocument();
  });

  test('renders Back button', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  test('renders Verify & Enable button', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Verify & Enable/ })).toBeInTheDocument();
  });

  test('calls onBack when Back button is clicked', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  test('Verify & Enable button is disabled when code is shorter than 6 characters', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} verificationCode="123" />);
    expect(screen.getByRole('button', { name: /Verify & Enable/ })).toBeDisabled();
  });

  test('Verify & Enable button is enabled with 6-digit code', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} verificationCode="123456" />);
    expect(screen.getByRole('button', { name: /Verify & Enable/ })).toBeEnabled();
  });

  test('Verify & Enable button is disabled when isSubmitting', () => {
    render(
      <TwoFactorVerifyDialog
        {...defaultProps}
        verificationCode="123456"
        isSubmitting={true}
      />
    );
    expect(screen.getByRole('button', { name: /Verify & Enable/ })).toBeDisabled();
  });

  test('calls onVerify when Verify & Enable button is clicked', () => {
    render(
      <TwoFactorVerifyDialog {...defaultProps} verificationCode="123456" />
    );
    fireEvent.click(screen.getByRole('button', { name: /Verify & Enable/ }));
    expect(defaultProps.onVerify).toHaveBeenCalledTimes(1);
  });

  test('shows error when error prop is provided', () => {
    render(
      <TwoFactorVerifyDialog {...defaultProps} error="Code is incorrect" />
    );
    expect(screen.getByText('Code is incorrect')).toBeInTheDocument();
  });

  test('does not render dialog when open is false', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Verify Your Authenticator')).not.toBeInTheDocument();
  });

  test('calls onCodeChange and onErrorClear when input changes', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} />);
    const input = screen.getByLabelText('Verification Code');
    fireEvent.change(input, { target: { value: '789' } });
    expect(defaultProps.onCodeChange).toHaveBeenCalled();
    expect(defaultProps.onErrorClear).toHaveBeenCalled();
  });

  test('does not call onVerify when button is disabled', () => {
    render(<TwoFactorVerifyDialog {...defaultProps} verificationCode="" />);
    const btn = screen.getByRole('button', { name: /Verify & Enable/ });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(defaultProps.onVerify).not.toHaveBeenCalled();
  });
});
