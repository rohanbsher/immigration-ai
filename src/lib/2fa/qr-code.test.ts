/**
 * Comprehensive tests for QR code generation.
 *
 * Tests cover:
 * - Data URL generation (PNG format)
 * - SVG generation
 * - Error handling
 * - QR code options (error correction, size, margins)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToDataURL, mockQRToString } = vi.hoisted(() => ({
  mockToDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQRCodeData'),
  mockQRToString: vi.fn().mockResolvedValue('<svg>mock SVG content</svg>'),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: mockToDataURL,
    toString: mockQRToString,
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

import { generateQRCodeDataURL, generateQRCodeSVG } from './qr-code';

describe('generateQRCodeDataURL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToDataURL.mockResolvedValue('data:image/png;base64,mockQRCodeData');
  });

  it('generates a data URL for a valid URI', async () => {
    const uri = 'otpauth://totp/Test:user@example.com?secret=TEST';
    const result = await generateQRCodeDataURL(uri);
    expect(result).toBe('data:image/png;base64,mockQRCodeData');
  });

  it('passes correct options to QRCode.toDataURL', async () => {
    const uri = 'otpauth://totp/Test:user@example.com?secret=TEST';
    await generateQRCodeDataURL(uri);

    expect(mockToDataURL).toHaveBeenCalledWith(uri, expect.objectContaining({
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 256,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    }));
  });

  it('passes the URI to the QR code library', async () => {
    const uri = 'otpauth://totp/Immigration%20AI:test@example.com?secret=ABC123';
    await generateQRCodeDataURL(uri);
    expect(mockToDataURL).toHaveBeenCalledWith(uri, expect.anything());
  });

  it('throws "Failed to generate QR code" when library fails', async () => {
    mockToDataURL.mockRejectedValueOnce(new Error('Generation failed'));
    await expect(generateQRCodeDataURL('invalid')).rejects.toThrow('Failed to generate QR code');
  });

  it('wraps unexpected errors in the standard error message', async () => {
    mockToDataURL.mockRejectedValueOnce(new TypeError('Unexpected type error'));
    await expect(generateQRCodeDataURL('test')).rejects.toThrow('Failed to generate QR code');
  });

  it('handles empty URI input', async () => {
    const result = await generateQRCodeDataURL('');
    expect(result).toBe('data:image/png;base64,mockQRCodeData');
    expect(mockToDataURL).toHaveBeenCalledWith('', expect.anything());
  });
});

describe('generateQRCodeSVG', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQRToString.mockResolvedValue('<svg>mock SVG content</svg>');
  });

  it('generates an SVG string for a valid URI', async () => {
    const uri = 'otpauth://totp/Test:user@example.com?secret=TEST';
    const result = await generateQRCodeSVG(uri);
    expect(result).toBe('<svg>mock SVG content</svg>');
  });

  it('passes correct options to QRCode.toString', async () => {
    const uri = 'otpauth://totp/Test:user@example.com?secret=TEST';
    await generateQRCodeSVG(uri);

    expect(mockQRToString).toHaveBeenCalledWith(uri, expect.objectContaining({
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    }));
  });

  it('throws "Failed to generate QR code" when library fails', async () => {
    mockQRToString.mockRejectedValueOnce(new Error('SVG generation failed'));
    await expect(generateQRCodeSVG('invalid')).rejects.toThrow('Failed to generate QR code');
  });

  it('handles empty URI input', async () => {
    const result = await generateQRCodeSVG('');
    expect(result).toBe('<svg>mock SVG content</svg>');
  });
});
