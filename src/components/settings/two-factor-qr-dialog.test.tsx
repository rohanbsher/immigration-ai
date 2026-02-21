import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoFactorQrDialog } from './two-factor-qr-dialog';

// Mock next/image to render a regular img element
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe('TwoFactorQrDialog', () => {
  const defaultProps = {
    open: true,
    qrCodeDataUrl: 'data:image/png;base64,fakeqrcode',
    onClose: vi.fn(),
    onContinue: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders dialog title and description when open', () => {
    render(<TwoFactorQrDialog {...defaultProps} />);
    expect(screen.getByText('Set Up Authenticator App')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Scan this QR code with your authenticator app/
      )
    ).toBeInTheDocument();
  });

  test('renders QR code image when qrCodeDataUrl is provided', () => {
    render(<TwoFactorQrDialog {...defaultProps} />);
    const img = screen.getByAltText('2FA QR Code');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,fakeqrcode');
  });

  test('does not render QR code image when qrCodeDataUrl is null', () => {
    render(<TwoFactorQrDialog {...defaultProps} qrCodeDataUrl={null} />);
    expect(screen.queryByAltText('2FA QR Code')).not.toBeInTheDocument();
  });

  test('renders instruction text about 6-digit code', () => {
    render(<TwoFactorQrDialog {...defaultProps} />);
    expect(
      screen.getByText(/After scanning, your app will display a 6-digit code/)
    ).toBeInTheDocument();
  });

  test('renders Cancel button', () => {
    render(<TwoFactorQrDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  test('renders Continue button', () => {
    render(<TwoFactorQrDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  test('calls onClose when Cancel is clicked', () => {
    render(<TwoFactorQrDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onContinue when Continue is clicked', () => {
    render(<TwoFactorQrDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(defaultProps.onContinue).toHaveBeenCalledTimes(1);
  });

  test('does not render dialog when open is false', () => {
    render(<TwoFactorQrDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Set Up Authenticator App')).not.toBeInTheDocument();
  });

  test('mentions supported authenticator apps in description', () => {
    render(<TwoFactorQrDialog {...defaultProps} />);
    expect(
      screen.getByText(/Google Authenticator, Authy, or 1Password/)
    ).toBeInTheDocument();
  });
});
