import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CookieConsentBanner } from './cookie-consent-banner';

// Mock the useConsent hook
const mockAcceptAll = vi.fn();
const mockRejectAll = vi.fn();
const mockUseConsent = vi.fn();

vi.mock('@/hooks/use-consent', () => ({
  useConsent: (...args: unknown[]) => mockUseConsent(...args),
}));

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConsent.mockReturnValue({
      analyticsConsented: null,
      consentLoaded: true,
      acceptAll: mockAcceptAll,
      rejectAll: mockRejectAll,
    });
  });

  test('renders banner with cookie consent message', () => {
    render(<CookieConsentBanner />);
    expect(
      screen.getByText(/We use cookies for analytics and session replay/)
    ).toBeInTheDocument();
  });

  test('renders as a dialog with correct aria-label', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByRole('dialog', { name: 'Cookie consent' })).toBeInTheDocument();
  });

  test('renders Accept All button', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByRole('button', { name: 'Accept All' })).toBeInTheDocument();
  });

  test('renders Reject All button', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByRole('button', { name: 'Reject All' })).toBeInTheDocument();
  });

  test('calls acceptAll when Accept All is clicked', () => {
    render(<CookieConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept All' }));
    expect(mockAcceptAll).toHaveBeenCalledTimes(1);
  });

  test('calls rejectAll when Reject All is clicked', () => {
    render(<CookieConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject All' }));
    expect(mockRejectAll).toHaveBeenCalledTimes(1);
  });

  test('renders nothing when consentLoaded is false', () => {
    mockUseConsent.mockReturnValue({
      analyticsConsented: null,
      consentLoaded: false,
      acceptAll: mockAcceptAll,
      rejectAll: mockRejectAll,
    });
    const { container } = render(<CookieConsentBanner />);
    expect(container.innerHTML).toBe('');
  });

  test('renders nothing when user already accepted (analyticsConsented is true)', () => {
    mockUseConsent.mockReturnValue({
      analyticsConsented: true,
      consentLoaded: true,
      acceptAll: mockAcceptAll,
      rejectAll: mockRejectAll,
    });
    const { container } = render(<CookieConsentBanner />);
    expect(container.innerHTML).toBe('');
  });

  test('renders nothing when user already rejected (analyticsConsented is false)', () => {
    mockUseConsent.mockReturnValue({
      analyticsConsented: false,
      consentLoaded: true,
      acceptAll: mockAcceptAll,
      rejectAll: mockRejectAll,
    });
    const { container } = render(<CookieConsentBanner />);
    expect(container.innerHTML).toBe('');
  });

  test('renders banner only when consent is undecided (null) and loaded', () => {
    mockUseConsent.mockReturnValue({
      analyticsConsented: null,
      consentLoaded: true,
      acceptAll: mockAcceptAll,
      rejectAll: mockRejectAll,
    });
    render(<CookieConsentBanner />);
    expect(screen.getByRole('dialog', { name: 'Cookie consent' })).toBeInTheDocument();
  });

  test('mentions non-essential cookies in the message', () => {
    render(<CookieConsentBanner />);
    expect(
      screen.getByText(/accept or reject non-essential cookies/)
    ).toBeInTheDocument();
  });
});
