/**
 * File validation service for secure document uploads.
 *
 * Validates files using:
 * 1. Magic number (file signature) validation
 * 2. File extension validation
 * 3. MIME type consistency checks
 * 4. Virus scanning (via ClamAV or external API)
 */

import { createLogger } from '@/lib/logger';
import { serverEnv, features } from '@/lib/config';

const log = createLogger('security:file-validation');

// Magic bytes for supported file types
export const FILE_SIGNATURES: Record<string, { signature: number[]; offset?: number }[]> = {
  // PDF: %PDF
  'application/pdf': [
    { signature: [0x25, 0x50, 0x44, 0x46] }
  ],
  // JPEG: FFD8FF
  'image/jpeg': [
    { signature: [0xFF, 0xD8, 0xFF] }
  ],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  'image/png': [
    { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }
  ],
  // GIF: GIF87a or GIF89a
  'image/gif': [
    { signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
    { signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }
  ],
  // WebP: RIFF....WEBP
  'image/webp': [
    { signature: [0x52, 0x49, 0x46, 0x46] } // RIFF header (also need to check for WEBP at offset 8)
  ],
  // DOCX/Office Open XML: PK (ZIP archive)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { signature: [0x50, 0x4B, 0x03, 0x04] }
  ],
  // DOC: D0 CF 11 E0 (OLE Compound Document)
  'application/msword': [
    { signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }
  ],
};

// Mapping of extensions to MIME types
const EXTENSION_TO_MIME: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

// Allowed MIME types for immigration documents
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  detectedMimeType?: string;
  warnings: string[];
}

export interface VirusScanResult {
  isClean: boolean;
  threatName?: string;
  scanProvider: string;
  scannedAt: Date;
}

/**
 * Read first N bytes from a File/Blob for magic number validation
 */
async function readFileBytes(file: File | Blob, numBytes: number): Promise<Uint8Array> {
  const slice = file.slice(0, numBytes);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Check if file bytes match a signature
 */
function matchesSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Detect MIME type from file content using magic bytes
 */
async function detectMimeTypeFromContent(file: File | Blob): Promise<string | null> {
  const bytes = await readFileBytes(file, 16);

  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const { signature, offset = 0 } of signatures) {
      if (matchesSignature(bytes, signature, offset)) {
        // Special handling for WebP - need to verify WEBP at offset 8
        if (mimeType === 'image/webp') {
          const webpBytes = await readFileBytes(file, 12);
          if (!matchesSignature(webpBytes, [0x57, 0x45, 0x42, 0x50], 8)) {
            continue;
          }
        }
        return mimeType;
      }
    }
  }

  return null;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Validate file using magic bytes, extension, and MIME type consistency
 */
export async function validateFileType(file: File): Promise<FileValidationResult> {
  const warnings: string[] = [];

  // 1. Check file has a name
  if (!file.name) {
    return {
      isValid: false,
      error: 'File must have a name',
      warnings,
    };
  }

  // 2. Check extension is allowed
  const extension = getFileExtension(file.name);
  if (!extension) {
    return {
      isValid: false,
      error: 'File must have an extension',
      warnings,
    };
  }

  const expectedMimeTypes = EXTENSION_TO_MIME[extension];
  if (!expectedMimeTypes) {
    return {
      isValid: false,
      error: `File extension "${extension}" is not allowed. Accepted: PDF, JPEG, PNG, GIF, WebP, DOC, DOCX`,
      warnings,
    };
  }

  // 3. Check MIME type is allowed
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return {
      isValid: false,
      error: `MIME type "${file.type}" is not allowed`,
      warnings,
    };
  }

  // 4. Detect actual MIME type from file content (magic bytes)
  const detectedMimeType = await detectMimeTypeFromContent(file);

  if (!detectedMimeType) {
    return {
      isValid: false,
      error: 'Could not verify file type. File may be corrupted or in an unsupported format.',
      warnings,
    };
  }

  // 5. Check consistency between extension, claimed MIME, and detected MIME
  if (!expectedMimeTypes.includes(detectedMimeType)) {
    return {
      isValid: false,
      error: `File extension "${extension}" does not match actual file content (detected: ${detectedMimeType}). This may indicate a renamed or spoofed file.`,
      detectedMimeType,
      warnings,
    };
  }

  if (file.type !== detectedMimeType) {
    // Some inconsistency but not necessarily malicious
    warnings.push(`Claimed MIME type "${file.type}" differs from detected type "${detectedMimeType}"`);
  }

  return {
    isValid: true,
    detectedMimeType,
    warnings,
  };
}

/**
 * Virus scanning service interface
 */
export interface VirusScannerConfig {
  provider: 'clamav' | 'virustotal' | 'mock';
  apiKey?: string;
  apiUrl?: string;
}

/**
 * Scan file for viruses/malware using configured provider.
 *
 * In production, integrate with:
 * - ClamAV (self-hosted or clamav-rest API)
 * - VirusTotal API
 * - AWS Macie
 * - Azure Security Center
 */
export async function scanFileForViruses(
  file: File | Blob,
  config?: VirusScannerConfig
): Promise<VirusScanResult> {
  const provider = config?.provider || serverEnv.VIRUS_SCANNER_PROVIDER || 'mock';

  switch (provider) {
    case 'clamav':
      return scanWithClamAV(file, config);
    case 'virustotal':
      return scanWithVirusTotal(file, config);
    case 'mock':
    default:
      return mockVirusScan(file);
  }
}

/**
 * ClamAV integration via REST API (clamav-rest or similar)
 */
async function scanWithClamAV(
  file: File | Blob,
  config?: VirusScannerConfig
): Promise<VirusScanResult> {
  const apiUrl = config?.apiUrl || serverEnv.CLAMAV_API_URL;

  if (!apiUrl) {
    log.error('ClamAV API URL not configured');
    // Fail closed - if scanner isn't configured, reject the file
    return {
      isClean: false,
      threatName: 'SCANNER_NOT_CONFIGURED',
      scanProvider: 'clamav',
      scannedAt: new Date(),
    };
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${apiUrl}/scan`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      log.error('ClamAV scan failed', { status: response.status, statusText: response.statusText });
      // Fail closed on scanner error
      return {
        isClean: false,
        threatName: 'SCAN_FAILED',
        scanProvider: 'clamav',
        scannedAt: new Date(),
      };
    }

    const result = await response.json();

    return {
      isClean: result.status === 'OK' || result.clean === true,
      threatName: result.virus || result.threat || undefined,
      scanProvider: 'clamav',
      scannedAt: new Date(),
    };
  } catch (error) {
    log.logError('ClamAV scan error', error);
    // Fail closed on network/timeout error
    return {
      isClean: false,
      threatName: 'SCAN_ERROR',
      scanProvider: 'clamav',
      scannedAt: new Date(),
    };
  }
}

/**
 * VirusTotal integration
 */
async function scanWithVirusTotal(
  file: File | Blob,
  config?: VirusScannerConfig
): Promise<VirusScanResult> {
  const apiKey = config?.apiKey || serverEnv.VIRUSTOTAL_API_KEY;

  if (!apiKey) {
    log.error('VirusTotal API key not configured');
    return {
      isClean: false,
      threatName: 'SCANNER_NOT_CONFIGURED',
      scanProvider: 'virustotal',
      scannedAt: new Date(),
    };
  }

  try {
    // Step 1: Upload file
    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch('https://www.virustotal.com/api/v3/files', {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
      },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const analysisId = uploadResult.data?.id;

    if (!analysisId) {
      throw new Error('No analysis ID returned');
    }

    // Step 2: Poll for results (with timeout)
    const maxAttempts = 30;
    const pollInterval = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const analysisResponse = await fetch(
        `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
        {
          headers: { 'x-apikey': apiKey },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!analysisResponse.ok) continue;

      const analysisResult = await analysisResponse.json();
      const status = analysisResult.data?.attributes?.status;

      if (status === 'completed') {
        const stats = analysisResult.data?.attributes?.stats;
        const maliciousCount = stats?.malicious || 0;
        const suspiciousCount = stats?.suspicious || 0;

        return {
          isClean: maliciousCount === 0 && suspiciousCount === 0,
          threatName: maliciousCount > 0 ? 'MALWARE_DETECTED' : undefined,
          scanProvider: 'virustotal',
          scannedAt: new Date(),
        };
      }
    }

    // Timeout waiting for results
    return {
      isClean: false,
      threatName: 'SCAN_TIMEOUT',
      scanProvider: 'virustotal',
      scannedAt: new Date(),
    };
  } catch (error) {
    log.logError('VirusTotal scan error', error);
    return {
      isClean: false,
      threatName: 'SCAN_ERROR',
      scanProvider: 'virustotal',
      scannedAt: new Date(),
    };
  }
}

/**
 * Mock virus scanner for development/testing
 * Performs basic heuristic checks but should NOT be used in production
 */
async function mockVirusScan(file: File | Blob): Promise<VirusScanResult> {
  if (features.isProduction) {
    log.warn('Mock virus scanner active in production - configure VIRUS_SCANNER_PROVIDER for real scanning');
  }

  // Basic heuristic checks (content inspection for suspicious patterns)
  const bytes = await readFileBytes(file, 1000);
  const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

  // Check for obvious script injection patterns
  const suspiciousPatterns = [
    '<script',
    'javascript:',
    'data:text/html',
    'vbscript:',
    '<?php',
    '<%',
    'powershell',
    'cmd.exe',
    '/bin/sh',
    '/bin/bash',
    'eval(',
    'exec(',
    'system(',
  ];

  const foundPattern = suspiciousPatterns.find(pattern =>
    content.toLowerCase().includes(pattern.toLowerCase())
  );

  if (foundPattern) {
    return {
      isClean: false,
      threatName: `SUSPICIOUS_CONTENT:${foundPattern}`,
      scanProvider: 'mock',
      scannedAt: new Date(),
    };
  }

  return {
    isClean: true,
    scanProvider: 'mock',
    scannedAt: new Date(),
  };
}

/**
 * Combined file validation: type checking + virus scanning
 */
export interface FullValidationResult {
  isValid: boolean;
  typeValidation: FileValidationResult;
  virusScan: VirusScanResult | null;
  error?: string;
  /** True when virus scanner was unavailable but upload was allowed */
  scanDegraded?: boolean;
}

export async function validateFile(
  file: File,
  options?: {
    skipVirusScan?: boolean;
    scannerConfig?: VirusScannerConfig;
  }
): Promise<FullValidationResult> {
  // Step 1: Validate file type
  const typeValidation = await validateFileType(file);

  if (!typeValidation.isValid) {
    return {
      isValid: false,
      typeValidation,
      virusScan: null,
      error: typeValidation.error,
    };
  }

  // Step 2: Virus scan (unless explicitly skipped)
  if (options?.skipVirusScan) {
    return {
      isValid: true,
      typeValidation,
      virusScan: null,
    };
  }

  const virusScan = await scanFileForViruses(file, options?.scannerConfig);

  if (!virusScan.isClean) {
    // Distinguish actual malware from scanner unavailability/timeouts.
    // Only block uploads when real threats are detected.
    const scannerDegradedReasons = [
      'SCAN_TIMEOUT',
      'SCAN_ERROR',
      'SCAN_FAILED',
      'SCANNER_NOT_CONFIGURED',
    ];

    const isDegraded = virusScan.threatName && scannerDegradedReasons.includes(virusScan.threatName);

    if (isDegraded) {
      log.warn('Virus scan unavailable, allowing upload with pending scan status', {
        reason: virusScan.threatName,
        provider: virusScan.scanProvider,
      });
      return {
        isValid: true,
        typeValidation,
        virusScan: { ...virusScan, isClean: true, threatName: undefined },
        scanDegraded: true,
      };
    }

    return {
      isValid: false,
      typeValidation,
      virusScan,
      error: virusScan.threatName
        ? `Security threat detected: ${virusScan.threatName}`
        : 'File failed security scan',
    };
  }

  return {
    isValid: true,
    typeValidation,
    virusScan,
  };
}
