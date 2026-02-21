import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiConsentSettings } from './ai-consent-settings';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the useAiConsent hook
const mockGrantConsent = vi.fn();
const mockRevokeConsent = vi.fn();
const mockUseAiConsent = vi.fn();

vi.mock('@/hooks/use-ai-consent', () => ({
  useAiConsent: (...args: unknown[]) => mockUseAiConsent(...args),
}));

describe('AiConsentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAiConsent.mockReturnValue({
      hasConsented: false,
      consentError: null,
      grantConsent: mockGrantConsent,
      revokeConsent: mockRevokeConsent,
    });
    mockGrantConsent.mockResolvedValue(undefined);
    mockRevokeConsent.mockResolvedValue(undefined);
  });

  test('renders card title with AI-Powered Features', () => {
    render(<AiConsentSettings />);
    expect(screen.getByText('AI-Powered Features')).toBeInTheDocument();
  });

  test('renders card description', () => {
    render(<AiConsentSettings />);
    expect(
      screen.getByText(/Allow AI to analyze your documents/)
    ).toBeInTheDocument();
  });

  test('renders feature list', () => {
    render(<AiConsentSettings />);
    expect(screen.getByText('Document analysis and data extraction')).toBeInTheDocument();
    expect(screen.getByText('Automated form filling suggestions')).toBeInTheDocument();
    expect(screen.getByText('Case success score predictions')).toBeInTheDocument();
    expect(screen.getByText('AI chat assistant for case questions')).toBeInTheDocument();
  });

  test('shows Disabled badge when not consented', () => {
    render(<AiConsentSettings />);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
  });

  test('shows Enable AI Features button when not consented', () => {
    render(<AiConsentSettings />);
    expect(screen.getByRole('button', { name: /Enable AI Features/ })).toBeInTheDocument();
  });

  test('shows Enabled badge when consented', () => {
    mockUseAiConsent.mockReturnValue({
      hasConsented: true,
      consentError: null,
      grantConsent: mockGrantConsent,
      revokeConsent: mockRevokeConsent,
    });
    render(<AiConsentSettings />);
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.queryByText('Disabled')).not.toBeInTheDocument();
  });

  test('shows Disable AI Features button when consented', () => {
    mockUseAiConsent.mockReturnValue({
      hasConsented: true,
      consentError: null,
      grantConsent: mockGrantConsent,
      revokeConsent: mockRevokeConsent,
    });
    render(<AiConsentSettings />);
    expect(screen.getByRole('button', { name: /Disable AI Features/ })).toBeInTheDocument();
  });

  test('calls grantConsent and shows success toast when Enable is clicked', async () => {
    const { toast } = await import('sonner');
    render(<AiConsentSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Enable AI Features/ }));
    await waitFor(() => {
      expect(mockGrantConsent).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('AI features enabled');
    });
  });

  test('shows error toast when grantConsent fails', async () => {
    const { toast } = await import('sonner');
    mockGrantConsent.mockRejectedValue(new Error('fail'));
    render(<AiConsentSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Enable AI Features/ }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to enable AI features');
    });
  });

  test('opens revoke confirmation dialog when Disable AI Features is clicked', () => {
    mockUseAiConsent.mockReturnValue({
      hasConsented: true,
      consentError: null,
      grantConsent: mockGrantConsent,
      revokeConsent: mockRevokeConsent,
    });
    render(<AiConsentSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Disable AI Features/ }));
    expect(screen.getByText(/Disabling AI features will prevent document analysis/)).toBeInTheDocument();
  });

  test('revoke dialog has Cancel and Disable AI Features buttons', () => {
    mockUseAiConsent.mockReturnValue({
      hasConsented: true,
      consentError: null,
      grantConsent: mockGrantConsent,
      revokeConsent: mockRevokeConsent,
    });
    render(<AiConsentSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Disable AI Features/ }));

    const buttons = screen.getAllByRole('button', { name: /Disable AI Features/ });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  test('calls revokeConsent and shows success toast when confirmed', async () => {
    const { toast } = await import('sonner');
    mockUseAiConsent.mockReturnValue({
      hasConsented: true,
      consentError: null,
      grantConsent: mockGrantConsent,
      revokeConsent: mockRevokeConsent,
    });
    render(<AiConsentSettings />);

    // Open the dialog
    fireEvent.click(screen.getByRole('button', { name: /Disable AI Features/ }));

    // Click the destructive Disable button inside the dialog
    const disableButtons = screen.getAllByRole('button', { name: /Disable AI Features/ });
    // The destructive button is the one inside the dialog (last one)
    const dialogDisableBtn = disableButtons[disableButtons.length - 1];
    fireEvent.click(dialogDisableBtn);

    await waitFor(() => {
      expect(mockRevokeConsent).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('AI features disabled');
    });
  });

  test('shows error toast when revokeConsent fails', async () => {
    const { toast } = await import('sonner');
    mockRevokeConsent.mockRejectedValue(new Error('fail'));
    mockUseAiConsent.mockReturnValue({
      hasConsented: true,
      consentError: null,
      grantConsent: mockGrantConsent,
      revokeConsent: mockRevokeConsent,
    });
    render(<AiConsentSettings />);

    fireEvent.click(screen.getByRole('button', { name: /Disable AI Features/ }));
    const disableButtons = screen.getAllByRole('button', { name: /Disable AI Features/ });
    fireEvent.click(disableButtons[disableButtons.length - 1]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to disable AI features');
    });
  });

  test('shows consentError text when present', () => {
    mockUseAiConsent.mockReturnValue({
      hasConsented: false,
      consentError: 'Something went wrong',
      grantConsent: mockGrantConsent,
      revokeConsent: mockRevokeConsent,
    });
    render(<AiConsentSettings />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('Cancel button in revoke dialog closes it', () => {
    mockUseAiConsent.mockReturnValue({
      hasConsented: true,
      consentError: null,
      grantConsent: mockGrantConsent,
      revokeConsent: mockRevokeConsent,
    });
    render(<AiConsentSettings />);
    fireEvent.click(screen.getByRole('button', { name: /Disable AI Features/ }));
    expect(screen.getByText(/Disabling AI features will prevent/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Disabling AI features will prevent/)).not.toBeInTheDocument();
  });
});
