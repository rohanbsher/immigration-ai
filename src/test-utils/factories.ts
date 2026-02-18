/**
 * Unit test factories for creating mock data.
 * Used with Vitest for isolated unit testing.
 */

import type { UserRole } from '@/types';
import { FILE_SIGNATURES } from '@/lib/file-validation';

/**
 * Get magic bytes for a given MIME type from the canonical FILE_SIGNATURES.
 * Falls back to empty array if MIME type is not found.
 */
function getMagicBytes(mimeType: string): number[] {
  const signatures = FILE_SIGNATURES[mimeType];
  return signatures?.[0]?.signature ?? [];
}

/**
 * Create a file from raw bytes that works in jsdom test environment.
 * Use this when you need to test specific byte patterns that aren't
 * covered by createMockFile's built-in types.
 */
export function createFileFromBytes(
  bytes: Uint8Array,
  name: string,
  type: string
): File {
  // Use MockFile implementation below
  return new MockFile(bytes, name, { type }) as unknown as File;
}

/**
 * Create mock form data for testing form validation
 */
export function createFormData(overrides: Partial<{
  petitioner: Record<string, unknown>;
  beneficiary: Record<string, unknown>;
  address: Record<string, unknown>;
}> = {}): Record<string, unknown> {
  return {
    petitioner: {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1980-01-15',
      ssn: '123-45-6789',
      email: 'john@example.com',
      phone: '555-123-4567',
      ...overrides.petitioner,
    },
    beneficiary: {
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1985-06-20',
      alienNumber: 'A123456789',
      passportNumber: 'AB1234567',
      countryOfBirth: 'Canada',
      ...overrides.beneficiary,
    },
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'United States',
      ...overrides.address,
    },
    ...overrides,
  };
}

/**
 * Create mock AI-filled data with configurable confidence scores
 */
export function createAIFilledData(options: {
  fields?: string[];
  confidenceRange?: { min: number; max: number };
  fixedConfidence?: number;
} = {}): {
  aiFilledData: Record<string, unknown>;
  confidenceScores: Record<string, number>;
} {
  const {
    fields = ['firstName', 'lastName', 'dateOfBirth', 'address.street', 'address.city'],
    confidenceRange = { min: 0.5, max: 0.95 },
    fixedConfidence,
  } = options;

  const aiFilledData: Record<string, unknown> = {};
  const confidenceScores: Record<string, number> = {};

  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    aiFilledData[field] = `AI-value-${field}`;
    confidenceScores[field] = fixedConfidence !== undefined
      ? fixedConfidence
      : confidenceRange.min + (index / (fields.length - 1 || 1)) * (confidenceRange.max - confidenceRange.min);
  }

  return { aiFilledData, confidenceScores };
}

/**
 * Create mock user profile for testing permissions
 */
export function createMockProfile(role: UserRole, overrides: Partial<{
  id: string;
  email: string;
  name: string;
  firmId: string;
  createdAt: string;
}> = {}): {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  firmId: string | null;
  createdAt: string;
} {
  return {
    id: overrides.id || `user-${Date.now()}`,
    email: overrides.email || `${role}@test.example.com`,
    name: overrides.name || `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    role,
    firmId: overrides.firmId || (role === 'attorney' ? `firm-${Date.now()}` : null),
    createdAt: overrides.createdAt || new Date().toISOString(),
  };
}

/**
 * Create mock case data
 */
export function createMockCase(overrides: Partial<{
  id: string;
  title: string;
  type: string;
  status: string;
  clientId: string;
  attorneyId: string;
  firmId: string;
  createdAt: string;
}> = {}): Record<string, unknown> {
  return {
    id: overrides.id || `case-${Date.now()}`,
    title: overrides.title || 'Test Case',
    type: overrides.type || 'H-1B',
    status: overrides.status || 'intake',
    clientId: overrides.clientId || `client-${Date.now()}`,
    attorneyId: overrides.attorneyId || `attorney-${Date.now()}`,
    firmId: overrides.firmId || `firm-${Date.now()}`,
    createdAt: overrides.createdAt || new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock document data
 */
export function createMockDocument(overrides: Partial<{
  id: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  status: string;
  caseId: string;
  uploadedBy: string;
  createdAt: string;
}> = {}): Record<string, unknown> {
  return {
    id: overrides.id || `doc-${Date.now()}`,
    name: overrides.name || 'test-document.pdf',
    type: overrides.type || 'passport',
    mimeType: overrides.mimeType || 'application/pdf',
    size: overrides.size || 1024000,
    status: overrides.status || 'pending',
    caseId: overrides.caseId || `case-${Date.now()}`,
    uploadedBy: overrides.uploadedBy || `user-${Date.now()}`,
    createdAt: overrides.createdAt || new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock File that works in jsdom test environment.
 * jsdom's Blob.slice().arrayBuffer() doesn't work properly,
 * so we need to create a custom implementation.
 */
class MockFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  private _content: Uint8Array;

  constructor(content: Uint8Array, name: string, options: { type: string }) {
    this._content = content;
    this.name = name;
    this.type = options.type;
    this.size = content.length;
    this.lastModified = Date.now();
  }

  slice(start = 0, end?: number): MockBlob {
    const sliced = this._content.slice(start, end);
    return new MockBlob(sliced, { type: this.type });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    // Copy to a new ArrayBuffer to avoid type issues with ArrayBufferLike
    const copy = new Uint8Array(this._content);
    return copy.buffer as ArrayBuffer;
  }

  async text(): Promise<string> {
    return new TextDecoder().decode(this._content);
  }

  stream(): ReadableStream<Uint8Array> {
    const content = this._content;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(content);
        controller.close();
      }
    });
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(this._content);
  }

  get webkitRelativePath(): string {
    return '';
  }
}

class MockBlob {
  type: string;
  size: number;
  private _content: Uint8Array;

  constructor(content: Uint8Array, options: { type: string }) {
    this._content = content;
    this.type = options.type;
    this.size = content.length;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    // Copy to a new ArrayBuffer to avoid type issues with ArrayBufferLike
    const copy = new Uint8Array(this._content);
    return copy.buffer as ArrayBuffer;
  }

  slice(start = 0, end?: number): MockBlob {
    const sliced = this._content.slice(start, end);
    return new MockBlob(sliced, { type: this.type });
  }

  async text(): Promise<string> {
    return new TextDecoder().decode(this._content);
  }

  stream(): ReadableStream<Uint8Array> {
    const content = this._content;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(content);
        controller.close();
      }
    });
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(this._content);
  }
}

/**
 * Create mock file for testing file validation
 */
export function createMockFile(options: {
  name?: string;
  type?: string;
  size?: number;
  content?: ArrayBuffer | string;
} = {}): File {
  const {
    name = 'test-file.pdf',
    type = 'application/pdf',
    size = 1024,
    content,
  } = options;

  // Create content based on file type for magic byte validation
  let contentArray: Uint8Array;

  if (content) {
    if (typeof content === 'string') {
      contentArray = new TextEncoder().encode(content);
    } else {
      contentArray = new Uint8Array(content);
    }
  } else {
    // Create content with correct magic bytes from canonical FILE_SIGNATURES
    const bytes = getMagicBytes(type);
    contentArray = new Uint8Array(Math.max(size, bytes.length));
    for (let i = 0; i < bytes.length; i++) {
      contentArray[i] = bytes[i];
    }
  }

  return new MockFile(contentArray, name, { type }) as unknown as File;
}

/**
 * Create a spoofed file (wrong magic bytes for extension)
 */
export function createSpoofedFile(options: {
  name?: string;
  claimedType?: string;
  actualContent?: 'exe' | 'script' | 'random';
} = {}): File {
  const {
    name = 'spoofed-file.pdf',
    claimedType = 'application/pdf',
    actualContent = 'exe',
  } = options;

  let content: Uint8Array;

  switch (actualContent) {
    case 'exe':
      // MZ header (Windows executable)
      content = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
      break;
    case 'script':
      content = new TextEncoder().encode('<script>alert("xss")</script>');
      break;
    default:
      content = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  }

  return new MockFile(content, name, { type: claimedType }) as unknown as File;
}

/**
 * Create mock reviewed fields data for form validation testing
 */
export function createReviewedFieldsData(
  fields: string[],
  reviewer = 'test-attorney'
): {
  reviewed_fields: Record<string, {
    reviewed_at: string;
    reviewed_by: string;
    original_value: unknown;
    accepted_value: unknown;
  }>;
} {
  const reviewed_fields: Record<string, {
    reviewed_at: string;
    reviewed_by: string;
    original_value: unknown;
    accepted_value: unknown;
  }> = {};

  for (const field of fields) {
    reviewed_fields[field] = {
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
      original_value: `original-${field}`,
      accepted_value: `accepted-${field}`,
    };
  }

  return { reviewed_fields };
}

/**
 * Create mock form for PDF generation testing
 */
export function createMockFormForPDF(formType: 'I-130' | 'I-485' | 'I-765' | 'I-131' | 'N-400' = 'I-130') {
  return {
    id: `form-${Date.now()}`,
    formType,
    data: createFormData(),
    aiFilledData: createAIFilledData().aiFilledData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create mock navigation items for RBAC testing
 */
export function createMockNavItems(count = 5): Array<{
  label: string;
  href: string;
  allowedRoles: UserRole[];
}> {
  const rolePatterns: UserRole[][] = [
    ['attorney'],
    ['attorney', 'client'],
    ['attorney', 'client', 'admin'],
  ];

  return Array.from({ length: count }, (_, i) => ({
    label: `Nav Item ${i + 1}`,
    href: `/dashboard/item-${i + 1}`,
    allowedRoles: rolePatterns[i % rolePatterns.length],
  }));
}

/**
 * Create mock API response for testing
 */
export function createMockApiResponse<T>(data: T, options: {
  success?: boolean;
  error?: string;
  status?: number;
} = {}): { data: T | null; error: string | null; status: number } {
  const { success = true, error = null, status = success ? 200 : 400 } = options;

  return {
    data: success ? data : null,
    error: success ? null : (error || 'An error occurred'),
    status,
  };
}

/**
 * Plan type for billing tests
 */
export type MockPlanType = 'free' | 'pro' | 'enterprise';

/**
 * Plan limits structure matching getUserPlanLimits return type
 */
export interface MockPlanLimits {
  planType: MockPlanType;
  maxCases: number;
  maxDocumentsPerCase: number;
  maxAiRequestsPerMonth: number;
  maxStorageGb: number;
  maxTeamMembers: number;
  features: {
    documentAnalysis: boolean;
    formAutofill: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
  };
}

/**
 * Default plan configurations matching the production limits
 */
const PLAN_DEFAULTS: Record<MockPlanType, MockPlanLimits> = {
  free: {
    planType: 'free',
    maxCases: 100,
    maxDocumentsPerCase: 50,
    maxAiRequestsPerMonth: 1000,
    maxStorageGb: 25,
    maxTeamMembers: 5,
    features: {
      documentAnalysis: true,
      formAutofill: true,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  pro: {
    planType: 'pro',
    maxCases: 250,
    maxDocumentsPerCase: 100,
    maxAiRequestsPerMonth: 2500,
    maxStorageGb: 50,
    maxTeamMembers: 10,
    features: {
      documentAnalysis: true,
      formAutofill: true,
      prioritySupport: true,
      apiAccess: false,
    },
  },
  enterprise: {
    planType: 'enterprise',
    maxCases: -1, // unlimited
    maxDocumentsPerCase: -1,
    maxAiRequestsPerMonth: -1,
    maxStorageGb: 500,
    maxTeamMembers: -1,
    features: {
      documentAnalysis: true,
      formAutofill: true,
      prioritySupport: true,
      apiAccess: true,
    },
  },
};

/**
 * Create mock plan limits for billing/quota tests.
 * Uses sensible defaults that match production configurations.
 *
 * @example
 * ```ts
 * // Get free plan defaults
 * const limits = createMockPlanLimits('free');
 *
 * // Override specific values
 * const limits = createMockPlanLimits('pro', { maxCases: 100 });
 *
 * // Usage with vitest mock
 * vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));
 * ```
 */
export function createMockPlanLimits(
  plan: MockPlanType,
  overrides: Partial<Omit<MockPlanLimits, 'planType' | 'features'>> & {
    features?: Partial<MockPlanLimits['features']>;
  } = {}
): MockPlanLimits {
  const defaults = PLAN_DEFAULTS[plan];
  const { features: featureOverrides, ...rest } = overrides;

  return {
    ...defaults,
    ...rest,
    features: {
      ...defaults.features,
      ...featureOverrides,
    },
  };
}
