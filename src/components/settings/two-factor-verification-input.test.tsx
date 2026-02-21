import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoFactorVerificationInput } from './two-factor-verification-input';

describe('TwoFactorVerificationInput', () => {
  const defaultProps = {
    id: 'test-code',
    value: '',
    onChange: vi.fn(),
    error: null as string | null,
    onErrorClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders label for verification code', () => {
    render(<TwoFactorVerificationInput {...defaultProps} />);
    expect(screen.getByLabelText('Verification Code')).toBeInTheDocument();
  });

  test('renders input with correct attributes', () => {
    render(<TwoFactorVerificationInput {...defaultProps} />);
    const input = screen.getByLabelText('Verification Code');
    expect(input).toHaveAttribute('id', 'test-code');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('placeholder', '000000');
  });

  test('renders with default maxLength of 6', () => {
    render(<TwoFactorVerificationInput {...defaultProps} />);
    const input = screen.getByLabelText('Verification Code');
    expect(input).toHaveAttribute('maxLength', '6');
  });

  test('renders with custom maxLength', () => {
    render(<TwoFactorVerificationInput {...defaultProps} maxLength={8} />);
    const input = screen.getByLabelText('Verification Code');
    expect(input).toHaveAttribute('maxLength', '8');
  });

  test('displays current value', () => {
    render(<TwoFactorVerificationInput {...defaultProps} value="123456" />);
    const input = screen.getByLabelText('Verification Code');
    expect(input).toHaveValue('123456');
  });

  test('calls onChange with filtered numeric value on input', () => {
    render(<TwoFactorVerificationInput {...defaultProps} />);
    const input = screen.getByLabelText('Verification Code');
    fireEvent.change(input, { target: { value: '12ab34' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('1234');
  });

  test('calls onErrorClear when input changes', () => {
    render(<TwoFactorVerificationInput {...defaultProps} />);
    const input = screen.getByLabelText('Verification Code');
    fireEvent.change(input, { target: { value: '1' } });
    expect(defaultProps.onErrorClear).toHaveBeenCalledTimes(1);
  });

  test('truncates input to maxLength', () => {
    render(<TwoFactorVerificationInput {...defaultProps} maxLength={6} />);
    const input = screen.getByLabelText('Verification Code');
    fireEvent.change(input, { target: { value: '12345678' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('123456');
  });

  test('shows error alert when error prop is set', () => {
    render(
      <TwoFactorVerificationInput {...defaultProps} error="Invalid code" />
    );
    expect(screen.getByText('Invalid code')).toBeInTheDocument();
  });

  test('does not show error alert when error is null', () => {
    render(<TwoFactorVerificationInput {...defaultProps} error={null} />);
    // Only the label and input should be present, no alert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('renders help text when provided', () => {
    render(
      <TwoFactorVerificationInput
        {...defaultProps}
        helpText="You can also use a backup code."
      />
    );
    expect(screen.getByText('You can also use a backup code.')).toBeInTheDocument();
  });

  test('does not render help text when not provided', () => {
    render(<TwoFactorVerificationInput {...defaultProps} />);
    expect(screen.queryByText('You can also use a backup code.')).not.toBeInTheDocument();
  });

  test('strips non-numeric characters from input', () => {
    render(<TwoFactorVerificationInput {...defaultProps} />);
    const input = screen.getByLabelText('Verification Code');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });

  test('handles empty input', () => {
    render(<TwoFactorVerificationInput {...defaultProps} value="123" />);
    const input = screen.getByLabelText('Verification Code');
    fireEvent.change(input, { target: { value: '' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });
});
