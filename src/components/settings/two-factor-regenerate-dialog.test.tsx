import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoFactorRegenerateDialog } from './two-factor-regenerate-dialog';

describe('TwoFactorRegenerateDialog', () => {
  const defaultProps = {
    open: true,
    verificationCode: '',
    onCodeChange: vi.fn(),
    error: null as string | null,
    onErrorClear: vi.fn(),
    isSubmitting: false,
    onRegenerate: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders dialog title and description when open', () => {
    render(<TwoFactorRegenerateDialog {...defaultProps} />);
    expect(screen.getByText('Regenerate Backup Codes')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Enter a verification code to generate new backup codes/
      )
    ).toBeInTheDocument();
  });

  test('mentions old codes will be invalidated', () => {
    render(<TwoFactorRegenerateDialog {...defaultProps} />);
    expect(
      screen.getByText(/Your old codes will be invalidated/)
    ).toBeInTheDocument();
  });

  test('renders verification code input', () => {
    render(<TwoFactorRegenerateDialog {...defaultProps} />);
    expect(screen.getByLabelText('Verification Code')).toBeInTheDocument();
  });

  test('renders Cancel button that calls onClose', () => {
    render(<TwoFactorRegenerateDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('renders Generate New Codes button', () => {
    render(<TwoFactorRegenerateDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Generate New Codes' })).toBeInTheDocument();
  });

  test('Generate New Codes button is disabled when code is shorter than 6 characters', () => {
    render(<TwoFactorRegenerateDialog {...defaultProps} verificationCode="12345" />);
    expect(screen.getByRole('button', { name: 'Generate New Codes' })).toBeDisabled();
  });

  test('Generate New Codes button is enabled when code has 6 characters', () => {
    render(<TwoFactorRegenerateDialog {...defaultProps} verificationCode="123456" />);
    expect(screen.getByRole('button', { name: 'Generate New Codes' })).toBeEnabled();
  });

  test('Generate New Codes button is disabled when isSubmitting', () => {
    render(
      <TwoFactorRegenerateDialog
        {...defaultProps}
        verificationCode="123456"
        isSubmitting={true}
      />
    );
    expect(screen.getByRole('button', { name: 'Generate New Codes' })).toBeDisabled();
  });

  test('calls onRegenerate when Generate New Codes is clicked', () => {
    render(
      <TwoFactorRegenerateDialog {...defaultProps} verificationCode="123456" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Generate New Codes' }));
    expect(defaultProps.onRegenerate).toHaveBeenCalledTimes(1);
  });

  test('shows error when error prop is provided', () => {
    render(
      <TwoFactorRegenerateDialog {...defaultProps} error="Invalid code" />
    );
    expect(screen.getByText('Invalid code')).toBeInTheDocument();
  });

  test('does not render dialog when open is false', () => {
    render(<TwoFactorRegenerateDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Regenerate Backup Codes')).not.toBeInTheDocument();
  });

  test('calls onCodeChange and onErrorClear when input changes', () => {
    render(<TwoFactorRegenerateDialog {...defaultProps} />);
    const input = screen.getByLabelText('Verification Code');
    fireEvent.change(input, { target: { value: '123' } });
    expect(defaultProps.onCodeChange).toHaveBeenCalled();
    expect(defaultProps.onErrorClear).toHaveBeenCalled();
  });
});
