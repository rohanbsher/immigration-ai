import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIConsentModal } from './ai-consent-modal';

describe('AIConsentModal', () => {
  const defaultProps = {
    open: true,
    onConsent: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders dialog title when open', () => {
    render(<AIConsentModal {...defaultProps} />);
    expect(screen.getByText('AI Data Processing Consent')).toBeInTheDocument();
  });

  test('renders description text', () => {
    render(<AIConsentModal {...defaultProps} />);
    expect(
      screen.getByText('Please review how your data will be processed before using AI features.')
    ).toBeInTheDocument();
  });

  test('lists OpenAI as a provider', () => {
    render(<AIConsentModal {...defaultProps} />);
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
  });

  test('lists Anthropic (Claude) as a provider', () => {
    render(<AIConsentModal {...defaultProps} />);
    expect(screen.getByText(/Anthropic \(Claude\)/)).toBeInTheDocument();
  });

  test('displays data sharing categories', () => {
    render(<AIConsentModal {...defaultProps} />);
    expect(screen.getByText(/Uploaded document images/)).toBeInTheDocument();
    expect(screen.getByText(/Case details/)).toBeInTheDocument();
    expect(screen.getByText(/Form field names and values/)).toBeInTheDocument();
    expect(screen.getByText(/Chat messages you send/)).toBeInTheDocument();
  });

  test('has Privacy Policy link', () => {
    render(<AIConsentModal {...defaultProps} />);
    const privacyLink = screen.getByText('Privacy Policy');
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');
  });

  test('has AI Disclaimer link', () => {
    render(<AIConsentModal {...defaultProps} />);
    const disclaimerLink = screen.getByText('AI Disclaimer');
    expect(disclaimerLink).toBeInTheDocument();
    expect(disclaimerLink.closest('a')).toHaveAttribute('href', '/ai-disclaimer');
  });

  test('calls onConsent when "I Understand & Agree" is clicked', () => {
    render(<AIConsentModal {...defaultProps} />);
    fireEvent.click(screen.getByText('I Understand & Agree'));
    expect(defaultProps.onConsent).toHaveBeenCalledTimes(1);
  });

  test('calls onCancel when "Cancel" is clicked', () => {
    render(<AIConsentModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test('does not render content when closed', () => {
    render(<AIConsentModal {...defaultProps} open={false} />);
    expect(screen.queryByText('AI Data Processing Consent')).not.toBeInTheDocument();
  });

  test('displays error message when error prop is provided', () => {
    render(<AIConsentModal {...defaultProps} error="Failed to save consent" />);
    expect(screen.getByText('Failed to save consent')).toBeInTheDocument();
  });

  test('does not display error section when error is null', () => {
    render(<AIConsentModal {...defaultProps} error={null} />);
    expect(screen.queryByText('Failed to save consent')).not.toBeInTheDocument();
  });

  test('does not display error section when error is undefined', () => {
    render(<AIConsentModal {...defaultProps} />);
    // No error alert container should exist
    const errorContainers = document.querySelectorAll('.text-destructive');
    // The container level destructive text shouldn't appear (only if error is present)
    expect(screen.queryByText('Failed to save consent')).not.toBeInTheDocument();
  });
});
