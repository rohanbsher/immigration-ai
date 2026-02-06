import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockQueryBuilder,
  mockUser,
  resetMocks,
  mockAuth,
  mockStorage,
} from '@/__mocks__/supabase';

// Create mock Supabase client - must be defined before vi.mock
const mockSupabase = {
  auth: mockAuth,
  from: vi.fn(),
  storage: mockStorage,
  rpc: vi.fn(),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockResolvedValue('subscribed'),
    unsubscribe: vi.fn().mockResolvedValue('unsubscribed'),
  }),
};

// Mock the Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock crypto module for documents service
vi.mock('@/lib/crypto', () => ({
  encryptSensitiveFields: vi.fn((data) => data),
  decryptSensitiveFields: vi.fn((data) => data),
}));

// Mock audit service for documents service
vi.mock('@/lib/audit', () => ({
  auditService: {
    logDelete: vi.fn().mockResolvedValue(null),
  },
}));

// Import services after mocking
import { casesService } from './cases';
import { clientsService } from './clients';
import { documentsService } from './documents';
import { formsService } from './forms';
import { profilesService } from './profiles';
import { notificationsService } from './notifications';
import { activitiesService } from './activities';
import * as firmsService from './firms';
import * as subscriptionsService from './subscriptions';

// Test data factories
const createMockCase = (overrides = {}) => ({
  id: 'case-123',
  attorney_id: 'attorney-456',
  client_id: 'client-789',
  visa_type: 'H1B',
  status: 'intake',
  title: 'H1B Visa Application',
  description: 'Test case description',
  priority_date: '2024-01-15',
  deadline: '2024-06-15',
  notes: 'Test notes',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  attorney: {
    id: 'attorney-456',
    first_name: 'John',
    last_name: 'Attorney',
    email: 'john@law.com',
  },
  client: {
    id: 'client-789',
    first_name: 'Jane',
    last_name: 'Client',
    email: 'jane@client.com',
  },
  documents: [{ count: 5 }],
  forms: [{ count: 2 }],
  ...overrides,
});

const createMockProfile = (overrides = {}) => ({
  id: 'profile-123',
  email: 'test@example.com',
  role: 'attorney',
  first_name: 'Test',
  last_name: 'User',
  phone: '555-1234',
  mfa_enabled: false,
  avatar_url: null,
  bar_number: 'BAR123',
  firm_name: 'Test Law Firm',
  specializations: ['H1B', 'EB1'],
  date_of_birth: null,
  country_of_birth: null,
  nationality: null,
  alien_number: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMockDocument = (overrides = {}) => ({
  id: 'doc-123',
  case_id: 'case-123',
  uploaded_by: 'user-123',
  document_type: 'passport',
  status: 'uploaded',
  file_name: 'passport.pdf',
  file_url: 'https://storage.example.com/passport.pdf',
  file_size: 1024000,
  mime_type: 'application/pdf',
  ai_extracted_data: null,
  ai_confidence_score: null,
  verified_by: null,
  verified_at: null,
  expiration_date: '2030-01-01',
  notes: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  uploader: {
    id: 'user-123',
    first_name: 'Test',
    last_name: 'Uploader',
  },
  verifier: null,
  ...overrides,
});

const createMockForm = (overrides = {}) => ({
  id: 'form-123',
  case_id: 'case-123',
  form_type: 'I-130',
  status: 'draft',
  form_data: {},
  ai_filled_data: null,
  ai_confidence_scores: null,
  review_notes: null,
  reviewed_by: null,
  reviewed_at: null,
  filed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  reviewer: null,
  ...overrides,
});

const createMockNotification = (overrides = {}) => ({
  id: 'notif-123',
  user_id: 'user-123',
  title: 'Test Notification',
  message: 'This is a test notification',
  type: 'info',
  read: false,
  action_url: '/dashboard/cases/123',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMockActivity = (overrides = {}) => ({
  id: 'activity-123',
  case_id: 'case-123',
  user_id: 'user-123',
  activity_type: 'case_created',
  description: 'Case was created',
  metadata: null,
  created_at: '2024-01-01T00:00:00Z',
  user: {
    id: 'user-123',
    first_name: 'Test',
    last_name: 'User',
    avatar_url: null,
  },
  ...overrides,
});

const createMockFirm = (overrides = {}) => ({
  id: 'firm-123',
  name: 'Test Law Firm',
  slug: 'test-law-firm',
  owner_id: 'user-123',
  logo_url: null,
  website: 'https://testlaw.com',
  phone: '555-1234',
  address: { city: 'New York', state: 'NY' },
  settings: {},
  subscription_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  ...overrides,
});

const createMockSubscription = (overrides = {}) => ({
  id: 'sub-123',
  customer_id: 'cust-123',
  stripe_subscription_id: 'sub_stripe123',
  stripe_price_id: 'price_123',
  plan_type: 'pro',
  status: 'active',
  billing_period: 'monthly',
  current_period_start: '2024-01-01T00:00:00Z',
  current_period_end: '2024-02-01T00:00:00Z',
  cancel_at_period_end: false,
  canceled_at: null,
  trial_start: null,
  trial_end: null,
  metadata: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  customers: { user_id: 'user-123' },
  ...overrides,
});

describe('Database Services', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // CASES SERVICE TESTS
  // ============================================================
  describe('casesService', () => {
    describe('getCases', () => {
      it('should fetch cases with default pagination', async () => {
        const mockCases = [createMockCase(), createMockCase({ id: 'case-456' })];
        const queryBuilder = createMockQueryBuilder(mockCases);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await casesService.getCases();

        expect(mockSupabase.from).toHaveBeenCalledWith('cases');
        expect(queryBuilder.select).toHaveBeenCalled();
        expect(queryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
        expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(queryBuilder.range).toHaveBeenCalledWith(0, 9);
        expect(result.cases).toHaveLength(2);
        expect(result.cases[0]).toHaveProperty('documents_count');
        expect(result.cases[0]).toHaveProperty('forms_count');
      });

      it('should apply status filter as array', async () => {
        const mockCases = [createMockCase()];
        const queryBuilder = createMockQueryBuilder(mockCases);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ status: ['intake', 'in_review'] });

        expect(queryBuilder.in).toHaveBeenCalledWith('status', ['intake', 'in_review']);
      });

      it('should apply status filter as single value', async () => {
        const mockCases = [createMockCase()];
        const queryBuilder = createMockQueryBuilder(mockCases);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ status: 'intake' });

        expect(queryBuilder.eq).toHaveBeenCalledWith('status', 'intake');
      });

      it('should apply visa_type filter as array', async () => {
        const mockCases = [createMockCase()];
        const queryBuilder = createMockQueryBuilder(mockCases);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ visa_type: ['H1B', 'L1'] });

        expect(queryBuilder.in).toHaveBeenCalledWith('visa_type', ['H1B', 'L1']);
      });

      it('should apply client_id filter', async () => {
        const mockCases = [createMockCase()];
        const queryBuilder = createMockQueryBuilder(mockCases);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ client_id: 'client-123' });

        expect(queryBuilder.eq).toHaveBeenCalledWith('client_id', 'client-123');
      });

      it('should apply search filter', async () => {
        const mockCases = [createMockCase()];
        const queryBuilder = createMockQueryBuilder(mockCases);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({ search: 'test' });

        expect(queryBuilder.or).toHaveBeenCalledWith('title.ilike.%test%');
      });

      it('should apply custom pagination and sorting', async () => {
        const mockCases = [createMockCase()];
        const queryBuilder = createMockQueryBuilder(mockCases);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.getCases({}, {
          page: 2,
          limit: 20,
          sortBy: 'title',
          sortOrder: 'asc',
        });

        expect(queryBuilder.order).toHaveBeenCalledWith('title', { ascending: true });
        expect(queryBuilder.range).toHaveBeenCalledWith(20, 39);
      });

      it('should throw error when query fails', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.range = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
          count: null,
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await expect(casesService.getCases()).rejects.toThrow();
      });
    });

    describe('getCase', () => {
      it('should fetch a single case by id', async () => {
        const mockCase = createMockCase();
        const queryBuilder = createMockQueryBuilder([mockCase]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await casesService.getCase('case-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('cases');
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'case-123');
        expect(queryBuilder.single).toHaveBeenCalled();
        expect(result).toHaveProperty('documents_count');
        expect(result).toHaveProperty('forms_count');
      });

      it('should return null when case not found', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await casesService.getCase('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('createCase', () => {
      it('should create a new case', async () => {
        const mockCase = createMockCase();
        const queryBuilder = createMockQueryBuilder([mockCase]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const createData = {
          client_id: 'client-789',
          visa_type: 'H1B' as const,
          title: 'New H1B Case',
          description: 'Test description',
        };

        const result = await casesService.createCase(createData);

        expect(mockSupabase.from).toHaveBeenCalledWith('cases');
        expect(queryBuilder.insert).toHaveBeenCalledWith({
          ...createData,
          attorney_id: mockUser.id,
          status: 'intake',
        });
        expect(result).toBeDefined();
      });

      it('should throw error when user not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });

        await expect(casesService.createCase({
          client_id: 'client-789',
          visa_type: 'H1B',
          title: 'Test',
        })).rejects.toThrow('Unauthorized');
      });

      it('should throw error when insert fails', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Insert failed' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await expect(casesService.createCase({
          client_id: 'client-789',
          visa_type: 'H1B',
          title: 'Test',
        })).rejects.toThrow();
      });
    });

    describe('updateCase', () => {
      it('should update an existing case', async () => {
        const updatedCase = createMockCase({ title: 'Updated Title' });
        const queryBuilder = createMockQueryBuilder([updatedCase]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await casesService.updateCase('case-123', {
          title: 'Updated Title',
          status: 'in_review',
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('cases');
        expect(queryBuilder.update).toHaveBeenCalledWith({
          title: 'Updated Title',
          status: 'in_review',
        });
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'case-123');
        expect(result).toBeDefined();
      });

      it('should throw error when update fails', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await expect(casesService.updateCase('case-123', {
          title: 'Test',
        })).rejects.toThrow();
      });
    });

    describe('deleteCase', () => {
      it('should soft delete a case', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await casesService.deleteCase('case-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('cases');
        expect(queryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({ deleted_at: expect.any(String) })
        );
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'case-123');
      });

      it('should throw error when delete fails', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Delete failed' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await expect(casesService.deleteCase('case-123')).rejects.toThrow();
      });
    });

    describe('restoreCase', () => {
      it('should restore a soft-deleted case', async () => {
        const restoredCase = createMockCase({ deleted_at: null });
        const queryBuilder = createMockQueryBuilder([restoredCase]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await casesService.restoreCase('case-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('cases');
        expect(queryBuilder.update).toHaveBeenCalledWith({ deleted_at: null });
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'case-123');
        expect(result).toBeDefined();
      });
    });

    describe('getCaseStats', () => {
      it('should return case statistics', async () => {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const mockCases = [
          { status: 'intake', deadline: nextWeek.toISOString() },
          { status: 'intake', deadline: null },
          { status: 'in_review', deadline: null },
          { status: 'approved', deadline: null },
        ];
        const queryBuilder = createMockQueryBuilder(mockCases);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await casesService.getCaseStats();

        expect(result.total).toBe(4);
        expect(result.byStatus.intake).toBe(2);
        expect(result.byStatus.in_review).toBe(1);
        expect(result.byStatus.approved).toBe(1);
        expect(result.pendingDeadlines).toBe(1);
      });

      it('should throw error when query fails', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.is = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await expect(casesService.getCaseStats()).rejects.toThrow();
      });
    });
  });

  // ============================================================
  // CLIENTS SERVICE TESTS
  // ============================================================
  describe('clientsService', () => {
    describe('getClients', () => {
      it('should fetch clients for the current attorney', async () => {
        // New implementation uses a single query with join
        // Returns cases with embedded client profile data
        const mockCasesWithClients = [
          {
            client_id: 'client-1',
            status: 'intake',
            client: createMockProfile({ id: 'client-1', first_name: 'Alice' }),
          },
          {
            client_id: 'client-1',
            status: 'approved',
            client: createMockProfile({ id: 'client-1', first_name: 'Alice' }),
          },
          {
            client_id: 'client-2',
            status: 'in_review',
            client: createMockProfile({ id: 'client-2', first_name: 'Bob' }),
          },
        ];

        const casesQueryBuilder = createMockQueryBuilder(mockCasesWithClients);
        mockSupabase.from.mockReturnValue(casesQueryBuilder);

        const result = await clientsService.getClients();

        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('cases_count');
        expect(result[0]).toHaveProperty('active_cases_count');
        // Verify case counts are aggregated correctly
        const alice = result.find((c) => c.first_name === 'Alice');
        const bob = result.find((c) => c.first_name === 'Bob');
        expect(alice?.cases_count).toBe(2);
        expect(alice?.active_cases_count).toBe(1); // intake is active, approved is not
        expect(bob?.cases_count).toBe(1);
        expect(bob?.active_cases_count).toBe(1); // in_review is active
      });

      it('should return empty array when no cases exist', async () => {
        const casesQueryBuilder = createMockQueryBuilder([]);
        mockSupabase.from.mockReturnValue(casesQueryBuilder);

        const result = await clientsService.getClients();

        expect(result).toEqual([]);
      });

      it('should throw error when user not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });

        await expect(clientsService.getClients()).rejects.toThrow('Unauthorized');
      });
    });

    describe('getClient', () => {
      it('should fetch a single client with case counts', async () => {
        const mockProfile = createMockProfile({ id: 'client-123' });
        const mockCases = [
          { status: 'intake' },
          { status: 'approved' },
          { status: 'in_review' },
        ];

        const profileQueryBuilder = createMockQueryBuilder([mockProfile]);
        const casesQueryBuilder = createMockQueryBuilder(mockCases);

        mockSupabase.from
          .mockReturnValueOnce(profileQueryBuilder)
          .mockReturnValueOnce(casesQueryBuilder);

        const result = await clientsService.getClientById('client-123');

        expect(result).not.toBeNull();
        expect(result?.cases_count).toBe(3);
        expect(result?.active_cases_count).toBe(2);
      });

      it('should return null when client not found', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await clientsService.getClientById('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('getClientCases', () => {
      it('should fetch cases for a specific client', async () => {
        const mockCases = [createMockCase(), createMockCase({ id: 'case-456' })];
        const queryBuilder = createMockQueryBuilder(mockCases);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await clientsService.getClientCases('client-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('cases');
        expect(queryBuilder.eq).toHaveBeenCalledWith('client_id', 'client-123');
        expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(result).toHaveLength(2);
      });

      it('should throw error when query fails', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.order = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await expect(clientsService.getClientCases('client-123')).rejects.toThrow();
      });
    });

    describe('updateClient', () => {
      it('should update client profile', async () => {
        const updatedProfile = createMockProfile({ first_name: 'Updated' });
        const queryBuilder = createMockQueryBuilder([updatedProfile]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await clientsService.updateClient('client-123', {
          first_name: 'Updated',
          phone: '555-9999',
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
        expect(queryBuilder.update).toHaveBeenCalledWith({
          first_name: 'Updated',
          phone: '555-9999',
        });
        expect(result).toBeDefined();
      });
    });

    describe('searchClients', () => {
      it('should search clients by query', async () => {
        const mockCases = [{ client_id: 'client-1' }, { client_id: 'client-2' }];
        const mockProfiles = [createMockProfile({ id: 'client-1', first_name: 'Test' })];

        const casesQueryBuilder = createMockQueryBuilder(mockCases);
        const profilesQueryBuilder = createMockQueryBuilder(mockProfiles);

        mockSupabase.from
          .mockReturnValueOnce(casesQueryBuilder)
          .mockReturnValueOnce(profilesQueryBuilder);

        const result = await clientsService.searchClients('Test');

        expect(result).toHaveLength(1);
        expect(profilesQueryBuilder.or).toHaveBeenCalled();
        expect(profilesQueryBuilder.limit).toHaveBeenCalledWith(10);
      });

      it('should return empty array when no clients for attorney', async () => {
        const casesQueryBuilder = createMockQueryBuilder([]);
        mockSupabase.from.mockReturnValue(casesQueryBuilder);

        const result = await clientsService.searchClients('Test');

        expect(result).toEqual([]);
      });
    });
  });

  // ============================================================
  // DOCUMENTS SERVICE TESTS
  // ============================================================
  describe('documentsService', () => {
    describe('getDocumentsByCase', () => {
      it('should fetch documents for a case', async () => {
        const mockDocs = [createMockDocument(), createMockDocument({ id: 'doc-456' })];
        const queryBuilder = createMockQueryBuilder(mockDocs);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await documentsService.getDocumentsByCase('case-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('documents');
        expect(queryBuilder.eq).toHaveBeenCalledWith('case_id', 'case-123');
        expect(queryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
        expect(result).toHaveLength(2);
      });

      it('should decrypt ai_extracted_data when present', async () => {
        const mockDoc = createMockDocument({
          ai_extracted_data: { passport_number: 'encrypted' },
        });
        const queryBuilder = createMockQueryBuilder([mockDoc]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await documentsService.getDocumentsByCase('case-123');

        expect(result).toHaveLength(1);
      });
    });

    describe('getDocument', () => {
      it('should fetch a single document', async () => {
        const mockDoc = createMockDocument();
        const queryBuilder = createMockQueryBuilder([mockDoc]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await documentsService.getDocument('doc-123');

        expect(result).not.toBeNull();
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'doc-123');
        expect(queryBuilder.single).toHaveBeenCalled();
      });

      it('should return null when document not found', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await documentsService.getDocument('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('createDocument', () => {
      it('should create a new document', async () => {
        const mockDoc = createMockDocument();
        const queryBuilder = createMockQueryBuilder([mockDoc]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const createData = {
          case_id: 'case-123',
          document_type: 'passport' as const,
          file_name: 'passport.pdf',
          file_url: 'https://storage.example.com/passport.pdf',
          file_size: 1024000,
          mime_type: 'application/pdf',
        };

        const result = await documentsService.createDocument(createData);

        expect(queryBuilder.insert).toHaveBeenCalledWith({
          ...createData,
          uploaded_by: mockUser.id,
          status: 'uploaded',
        });
        expect(result).toBeDefined();
      });

      it('should throw error when user not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });

        await expect(documentsService.createDocument({
          case_id: 'case-123',
          document_type: 'passport',
          file_name: 'test.pdf',
          file_url: 'https://example.com/test.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
        })).rejects.toThrow('Unauthorized');
      });
    });

    describe('updateDocument', () => {
      it('should update a document', async () => {
        const updatedDoc = createMockDocument({ status: 'verified' });
        const queryBuilder = createMockQueryBuilder([updatedDoc]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await documentsService.updateDocument('doc-123', {
          status: 'verified',
          ai_extracted_data: { name: 'Test' },
        });

        expect(queryBuilder.update).toHaveBeenCalled();
        expect(result).toBeDefined();
      });
    });

    describe('verifyDocument', () => {
      it('should mark document as verified', async () => {
        const verifiedDoc = createMockDocument({
          status: 'verified',
          verified_by: mockUser.id,
        });
        const queryBuilder = createMockQueryBuilder([verifiedDoc]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await documentsService.verifyDocument('doc-123');

        expect(queryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'verified',
            verified_by: mockUser.id,
            verified_at: expect.any(String),
          })
        );
        expect(result).toBeDefined();
      });

      it('should throw error when user not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });

        await expect(documentsService.verifyDocument('doc-123')).rejects.toThrow('Unauthorized');
      });
    });

    describe('deleteDocument', () => {
      it('should soft delete a document', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await documentsService.deleteDocument('doc-123');

        expect(queryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({ deleted_at: expect.any(String) })
        );
      });
    });

    describe('permanentlyDeleteDocument', () => {
      it('should permanently delete a document with audit log', async () => {
        const mockDoc = createMockDocument();
        const fetchQueryBuilder = createMockQueryBuilder([mockDoc]);
        const deleteQueryBuilder = createMockQueryBuilder([]);
        deleteQueryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });

        mockSupabase.from
          .mockReturnValueOnce(fetchQueryBuilder)
          .mockReturnValueOnce(deleteQueryBuilder);

        await documentsService.permanentlyDeleteDocument('doc-123');

        expect(deleteQueryBuilder.delete).toHaveBeenCalled();
      });

      it('should throw error when document not found', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await expect(documentsService.permanentlyDeleteDocument('non-existent'))
          .rejects.toThrow('Document not found');
      });
    });

    describe('restoreDocument', () => {
      it('should restore a soft-deleted document', async () => {
        const restoredDoc = createMockDocument({ deleted_at: null });
        const queryBuilder = createMockQueryBuilder([restoredDoc]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await documentsService.restoreDocument('doc-123');

        expect(queryBuilder.update).toHaveBeenCalledWith({ deleted_at: null });
        expect(result).toBeDefined();
      });
    });

    describe('getDocumentChecklist', () => {
      it('should fetch document checklist for visa type', async () => {
        const mockChecklist = [
          { document_type: 'passport', required: true, description: 'Valid passport' },
          { document_type: 'photo', required: true, description: 'Passport photo' },
        ];
        const queryBuilder = createMockQueryBuilder(mockChecklist);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await documentsService.getDocumentChecklist('H1B');

        expect(mockSupabase.from).toHaveBeenCalledWith('document_checklists');
        expect(queryBuilder.eq).toHaveBeenCalledWith('visa_type', 'H1B');
        expect(result).toHaveLength(2);
      });

      it('should return empty array on error', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await documentsService.getDocumentChecklist('H1B');

        expect(result).toEqual([]);
      });
    });
  });

  // ============================================================
  // FORMS SERVICE TESTS
  // ============================================================
  describe('formsService', () => {
    describe('getFormsByCase', () => {
      it('should fetch forms for a case', async () => {
        const mockForms = [createMockForm(), createMockForm({ id: 'form-456' })];
        const queryBuilder = createMockQueryBuilder(mockForms);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await formsService.getFormsByCase('case-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('forms');
        expect(queryBuilder.eq).toHaveBeenCalledWith('case_id', 'case-123');
        expect(result).toHaveLength(2);
      });
    });

    describe('getForm', () => {
      it('should fetch a single form', async () => {
        const mockForm = createMockForm();
        const queryBuilder = createMockQueryBuilder([mockForm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await formsService.getForm('form-123');

        expect(result).not.toBeNull();
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'form-123');
      });

      it('should return null when form not found', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await formsService.getForm('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('createForm', () => {
      it('should create a new form', async () => {
        const mockForm = createMockForm();
        const queryBuilder = createMockQueryBuilder([mockForm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await formsService.createForm({
          case_id: 'case-123',
          form_type: 'I-130',
          form_data: { field1: 'value1' },
        });

        expect(queryBuilder.insert).toHaveBeenCalledWith({
          case_id: 'case-123',
          form_type: 'I-130',
          form_data: { field1: 'value1' },
          status: 'draft',
        });
        expect(result).toBeDefined();
      });

      it('should use empty object for form_data if not provided', async () => {
        const mockForm = createMockForm();
        const queryBuilder = createMockQueryBuilder([mockForm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await formsService.createForm({
          case_id: 'case-123',
          form_type: 'I-130',
        });

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({ form_data: {} })
        );
      });
    });

    describe('updateForm', () => {
      it('should update a form', async () => {
        const updatedForm = createMockForm({ status: 'ai_filled' });
        const queryBuilder = createMockQueryBuilder([updatedForm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await formsService.updateForm('form-123', {
          status: 'ai_filled',
          ai_filled_data: { field1: 'ai_value' },
        });

        expect(queryBuilder.update).toHaveBeenCalled();
        expect(result).toBeDefined();
      });
    });

    describe('reviewForm', () => {
      it('should mark form as reviewed', async () => {
        const reviewedForm = createMockForm({
          status: 'approved',
          reviewed_by: mockUser.id,
        });
        const queryBuilder = createMockQueryBuilder([reviewedForm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await formsService.reviewForm('form-123', 'Looks good');

        expect(queryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'approved',
            review_notes: 'Looks good',
            reviewed_by: mockUser.id,
            reviewed_at: expect.any(String),
          })
        );
        expect(result).toBeDefined();
      });

      it('should throw error when user not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });

        await expect(formsService.reviewForm('form-123', 'Test'))
          .rejects.toThrow('Unauthorized');
      });
    });

    describe('markAsFiled', () => {
      it('should mark form as filed', async () => {
        const filedForm = createMockForm({ status: 'filed' });
        const queryBuilder = createMockQueryBuilder([filedForm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await formsService.markAsFiled('form-123');

        expect(queryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'filed',
            filed_at: expect.any(String),
          })
        );
        expect(result).toBeDefined();
      });
    });

    describe('deleteForm', () => {
      it('should soft delete a form', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await formsService.deleteForm('form-123');

        expect(queryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({ deleted_at: expect.any(String) })
        );
      });
    });

    describe('restoreForm', () => {
      it('should restore a soft-deleted form', async () => {
        const restoredForm = createMockForm({ deleted_at: null });
        const queryBuilder = createMockQueryBuilder([restoredForm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await formsService.restoreForm('form-123');

        expect(queryBuilder.update).toHaveBeenCalledWith({ deleted_at: null });
        expect(result).toBeDefined();
      });
    });
  });

  // ============================================================
  // PROFILES SERVICE TESTS
  // ============================================================
  describe('profilesService', () => {
    describe('getProfile', () => {
      it('should fetch a profile by user id', async () => {
        const mockProfile = createMockProfile();
        const queryBuilder = createMockQueryBuilder([mockProfile]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await profilesService.getProfile('user-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'user-123');
        expect(result).toBeDefined();
      });

      it('should return null when profile not found', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await profilesService.getProfile('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('getCurrentProfile', () => {
      it('should fetch the current user profile', async () => {
        const mockProfile = createMockProfile({ id: mockUser.id });
        const queryBuilder = createMockQueryBuilder([mockProfile]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await profilesService.getCurrentProfile();

        expect(mockSupabase.auth.getUser).toHaveBeenCalled();
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', mockUser.id);
        expect(result).toBeDefined();
      });

      it('should return null when user not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });

        const result = await profilesService.getCurrentProfile();

        expect(result).toBeNull();
      });
    });

    describe('updateProfile', () => {
      it('should update a profile', async () => {
        const updatedProfile = createMockProfile({ first_name: 'Updated' });
        const queryBuilder = createMockQueryBuilder([updatedProfile]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await profilesService.updateProfile('user-123', {
          first_name: 'Updated',
          phone: '555-9999',
        });

        expect(queryBuilder.update).toHaveBeenCalledWith({
          first_name: 'Updated',
          phone: '555-9999',
        });
        expect(result).toBeDefined();
      });

      it('should throw error when update fails', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await expect(profilesService.updateProfile('user-123', {
          first_name: 'Test',
        })).rejects.toThrow();
      });
    });

    describe('getClientsByAttorney', () => {
      it('should fetch clients for an attorney', async () => {
        const mockCases = [
          { client_id: 'client-1' },
          { client_id: 'client-1' },
          { client_id: 'client-2' },
        ];
        const mockProfiles = [
          createMockProfile({ id: 'client-1' }),
          createMockProfile({ id: 'client-2' }),
        ];

        const casesQueryBuilder = createMockQueryBuilder(mockCases);
        const profilesQueryBuilder = createMockQueryBuilder(mockProfiles);

        mockSupabase.from
          .mockReturnValueOnce(casesQueryBuilder)
          .mockReturnValueOnce(profilesQueryBuilder);

        const result = await profilesService.getClientsByAttorney('attorney-123');

        expect(result).toHaveLength(2);
      });

      it('should return empty array when attorney has no cases', async () => {
        const casesQueryBuilder = createMockQueryBuilder([]);
        mockSupabase.from.mockReturnValue(casesQueryBuilder);

        const result = await profilesService.getClientsByAttorney('attorney-123');

        expect(result).toEqual([]);
      });
    });

    describe('searchProfiles', () => {
      it('should search profiles by query', async () => {
        const mockProfiles = [createMockProfile()];
        const queryBuilder = createMockQueryBuilder(mockProfiles);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await profilesService.searchProfiles('Test');

        expect(queryBuilder.or).toHaveBeenCalled();
        expect(queryBuilder.limit).toHaveBeenCalledWith(20);
        expect(result).toHaveLength(1);
      });

      it('should filter by role when provided', async () => {
        const mockProfiles = [createMockProfile({ role: 'attorney' })];
        const queryBuilder = createMockQueryBuilder(mockProfiles);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await profilesService.searchProfiles('Test', 'attorney');

        expect(queryBuilder.eq).toHaveBeenCalledWith('role', 'attorney');
      });

      it('should return empty array on error', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.limit = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await profilesService.searchProfiles('Test');

        expect(result).toEqual([]);
      });
    });
  });

  // ============================================================
  // NOTIFICATIONS SERVICE TESTS
  // ============================================================
  describe('notificationsService', () => {
    describe('getNotifications', () => {
      it('should fetch notifications for a user', async () => {
        const mockNotifs = [
          createMockNotification(),
          createMockNotification({ id: 'notif-456' }),
        ];
        const queryBuilder = createMockQueryBuilder(mockNotifs);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await notificationsService.getNotifications('user-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
        expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(queryBuilder.limit).toHaveBeenCalledWith(50);
        expect(result).toHaveLength(2);
      });

      it('should filter unread only when specified', async () => {
        const mockNotifs = [createMockNotification({ read: false })];
        const queryBuilder = createMockQueryBuilder(mockNotifs);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.getNotifications('user-123', { unreadOnly: true });

        expect(queryBuilder.eq).toHaveBeenCalledWith('read', false);
      });

      it('should use custom limit when specified', async () => {
        const mockNotifs = [createMockNotification()];
        const queryBuilder = createMockQueryBuilder(mockNotifs);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.getNotifications('user-123', { limit: 10 });

        expect(queryBuilder.limit).toHaveBeenCalledWith(10);
      });
    });

    describe('getUnreadCount', () => {
      it('should return count of unread notifications', async () => {
        const queryBuilder = createMockQueryBuilder([], 5);
        // Override eq to resolve with count
        const finalQueryBuilder = {
          ...queryBuilder,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          })),
        };
        mockSupabase.from.mockReturnValue(finalQueryBuilder);

        const result = await notificationsService.getUnreadCount('user-123');

        expect(finalQueryBuilder.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
        expect(result).toBe(5);
      });

      it('should return 0 on error', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        // Override eq to resolve with error
        const finalQueryBuilder = {
          ...queryBuilder,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({
              count: null,
              error: { message: 'Query failed' },
            }),
          })),
        };
        mockSupabase.from.mockReturnValue(finalQueryBuilder);

        const result = await notificationsService.getUnreadCount('user-123');

        expect(result).toBe(0);
      });
    });

    describe('createNotification', () => {
      it('should create a new notification', async () => {
        const mockNotif = createMockNotification();
        const queryBuilder = createMockQueryBuilder([mockNotif]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await notificationsService.createNotification({
          user_id: 'user-123',
          title: 'Test',
          message: 'Test message',
          type: 'success',
        });

        expect(queryBuilder.insert).toHaveBeenCalledWith({
          user_id: 'user-123',
          title: 'Test',
          message: 'Test message',
          type: 'success',
          read: false,
        });
        expect(result).toBeDefined();
      });

      it('should default to info type', async () => {
        const mockNotif = createMockNotification();
        const queryBuilder = createMockQueryBuilder([mockNotif]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.createNotification({
          user_id: 'user-123',
          title: 'Test',
          message: 'Test message',
        });

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'info' })
        );
      });
    });

    describe('markAsRead', () => {
      it('should mark a notification as read', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.markAsRead('notif-123');

        expect(queryBuilder.update).toHaveBeenCalledWith({ read: true });
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'notif-123');
      });
    });

    describe('markAllAsRead', () => {
      it('should mark all notifications as read for a user', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockReturnThis();
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.markAllAsRead('user-123');

        expect(queryBuilder.update).toHaveBeenCalledWith({ read: true });
        expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(queryBuilder.eq).toHaveBeenCalledWith('read', false);
      });
    });

    describe('deleteNotification', () => {
      it('should delete a notification', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.deleteNotification('notif-123');

        expect(queryBuilder.delete).toHaveBeenCalled();
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'notif-123');
      });
    });

    describe('helper notification methods', () => {
      it('should create document uploaded notification', async () => {
        const mockNotif = createMockNotification();
        const queryBuilder = createMockQueryBuilder([mockNotif]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.notifyDocumentUploaded(
          'user-123',
          'passport.pdf',
          'case-123'
        );

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Document Uploaded',
            type: 'info',
            action_url: '/dashboard/cases/case-123?tab=documents',
          })
        );
      });

      it('should create document verified notification', async () => {
        const mockNotif = createMockNotification();
        const queryBuilder = createMockQueryBuilder([mockNotif]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.notifyDocumentVerified(
          'user-123',
          'passport.pdf',
          'case-123'
        );

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Document Verified',
            type: 'success',
          })
        );
      });

      it('should create form ready notification', async () => {
        const mockNotif = createMockNotification();
        const queryBuilder = createMockQueryBuilder([mockNotif]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.notifyFormReady('user-123', 'I-130', 'case-123');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Form Ready for Review',
            action_url: '/dashboard/cases/case-123?tab=forms',
          })
        );
      });

      it('should create deadline approaching notification', async () => {
        const mockNotif = createMockNotification();
        const queryBuilder = createMockQueryBuilder([mockNotif]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.notifyDeadlineApproaching(
          'user-123',
          'H1B Application',
          '2024-06-15',
          'case-123'
        );

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Deadline Approaching',
            type: 'warning',
          })
        );
      });

      it('should create status changed notification', async () => {
        const mockNotif = createMockNotification();
        const queryBuilder = createMockQueryBuilder([mockNotif]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await notificationsService.notifyStatusChanged(
          'user-123',
          'H1B Application',
          'Approved',
          'case-123'
        );

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Case Status Updated',
          })
        );
      });
    });
  });

  // ============================================================
  // ACTIVITIES SERVICE TESTS
  // ============================================================
  describe('activitiesService', () => {
    describe('getActivitiesByCase', () => {
      it('should fetch activities for a case', async () => {
        const mockActivities = [
          createMockActivity(),
          createMockActivity({ id: 'activity-456' }),
        ];
        const queryBuilder = createMockQueryBuilder(mockActivities);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await activitiesService.getActivitiesByCase('case-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('activities');
        expect(queryBuilder.eq).toHaveBeenCalledWith('case_id', 'case-123');
        expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(queryBuilder.limit).toHaveBeenCalledWith(50);
        expect(result).toHaveLength(2);
      });

      it('should use custom limit', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.getActivitiesByCase('case-123', 10);

        expect(queryBuilder.limit).toHaveBeenCalledWith(10);
      });
    });

    describe('getRecentActivities', () => {
      it('should fetch recent activities', async () => {
        const mockActivities = [createMockActivity()];
        const queryBuilder = createMockQueryBuilder(mockActivities);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await activitiesService.getRecentActivities();

        expect(mockSupabase.from).toHaveBeenCalledWith('activities');
        expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(queryBuilder.limit).toHaveBeenCalledWith(20);
        expect(result).toHaveLength(1);
      });
    });

    describe('createActivity', () => {
      it('should create a new activity', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await activitiesService.createActivity({
          case_id: 'case-123',
          activity_type: 'case_created',
          description: 'Case was created',
        });

        expect(queryBuilder.insert).toHaveBeenCalledWith({
          case_id: 'case-123',
          activity_type: 'case_created',
          description: 'Case was created',
          user_id: mockUser.id,
        });
        expect(result).toBeDefined();
      });

      it('should throw error when user not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });

        await expect(activitiesService.createActivity({
          case_id: 'case-123',
          activity_type: 'case_created',
          description: 'Test',
        })).rejects.toThrow('Unauthorized');
      });
    });

    describe('helper activity methods', () => {
      it('should log case created', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logCaseCreated('case-123', 'Test Case');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'case_created',
            description: 'Case "Test Case" was created',
          })
        );
      });

      it('should log case updated', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logCaseUpdated('case-123', 'Title was changed');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'case_updated',
            description: 'Title was changed',
          })
        );
      });

      it('should log status changed', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logStatusChanged('case-123', 'intake', 'in_review');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'status_changed',
            metadata: { old_status: 'intake', new_status: 'in_review' },
          })
        );
      });

      it('should log document uploaded', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logDocumentUploaded('case-123', 'passport.pdf', 'doc-123');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'document_uploaded',
            metadata: { document_id: 'doc-123' },
          })
        );
      });

      it('should log document analyzed', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logDocumentAnalyzed('case-123', 'passport.pdf', 'doc-123');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'document_analyzed',
          })
        );
      });

      it('should log document verified', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logDocumentVerified('case-123', 'passport.pdf', 'doc-123');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'document_verified',
          })
        );
      });

      it('should log form created', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logFormCreated('case-123', 'I-130', 'form-123');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'form_created',
            metadata: { form_id: 'form-123', form_type: 'I-130' },
          })
        );
      });

      it('should log form AI filled', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logFormAiFilled('case-123', 'I-130', 'form-123');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'form_ai_filled',
          })
        );
      });

      it('should log form reviewed', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logFormReviewed('case-123', 'I-130', 'form-123');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'form_reviewed',
          })
        );
      });

      it('should log form filed', async () => {
        const mockActivity = createMockActivity();
        const queryBuilder = createMockQueryBuilder([mockActivity]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await activitiesService.logFormFiled('case-123', 'I-130', 'form-123');

        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            activity_type: 'form_filed',
          })
        );
      });
    });
  });

  // ============================================================
  // FIRMS SERVICE TESTS
  // ============================================================
  describe('firmsService', () => {
    describe('createFirm', () => {
      it('should create a firm via RPC', async () => {
        const mockFirm = createMockFirm();
        mockSupabase.rpc.mockResolvedValue({ data: mockFirm, error: null });

        const result = await firmsService.createFirm(
          { name: 'Test Law Firm', website: 'https://testlaw.com' },
          'owner-123'
        );

        expect(mockSupabase.rpc).toHaveBeenCalledWith('create_firm_with_owner', {
          p_name: 'Test Law Firm',
          p_owner_id: 'owner-123',
          p_logo_url: null,
          p_website: 'https://testlaw.com',
          p_phone: null,
        });
        expect(result.name).toBe('Test Law Firm');
      });

      it('should throw error when RPC fails', async () => {
        mockSupabase.rpc.mockResolvedValue({
          data: null,
          error: { message: 'RPC failed' },
        });

        await expect(firmsService.createFirm(
          { name: 'Test' },
          'owner-123'
        )).rejects.toThrow('Failed to create firm');
      });
    });

    describe('getFirmById', () => {
      it('should fetch a firm by id', async () => {
        const mockFirm = createMockFirm();
        const queryBuilder = createMockQueryBuilder([mockFirm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.getFirmById('firm-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('firms');
        expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'firm-123');
        expect(result).not.toBeNull();
        expect(result?.name).toBe('Test Law Firm');
      });

      it('should return null when firm not found', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.getFirmById('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('getFirmBySlug', () => {
      it('should fetch a firm by slug', async () => {
        const mockFirm = createMockFirm();
        const queryBuilder = createMockQueryBuilder([mockFirm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.getFirmBySlug('test-law-firm');

        expect(queryBuilder.eq).toHaveBeenCalledWith('slug', 'test-law-firm');
        expect(result).not.toBeNull();
      });
    });

    describe('getUserFirms', () => {
      it('should fetch firms for a user', async () => {
        const mockMember = {
          firm_id: 'firm-123',
          firms: createMockFirm(),
        };
        const queryBuilder = createMockQueryBuilder([mockMember]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.getUserFirms('user-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('firm_members');
        expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(result).toHaveLength(1);
      });

      it('should filter out deleted firms', async () => {
        const mockMember = {
          firm_id: 'firm-123',
          firms: createMockFirm({ deleted_at: '2024-01-01' }),
        };
        const queryBuilder = createMockQueryBuilder([mockMember]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.getUserFirms('user-123');

        expect(result).toHaveLength(0);
      });
    });

    describe('updateFirm', () => {
      it('should update a firm', async () => {
        const updatedFirm = createMockFirm({ name: 'Updated Firm' });
        const queryBuilder = createMockQueryBuilder([updatedFirm]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.updateFirm('firm-123', {
          name: 'Updated Firm',
          website: 'https://updated.com',
        });

        expect(queryBuilder.update).toHaveBeenCalledWith({
          name: 'Updated Firm',
          website: 'https://updated.com',
        });
        expect(result.name).toBe('Updated Firm');
      });
    });

    describe('deleteFirm', () => {
      it('should soft delete a firm', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await firmsService.deleteFirm('firm-123');

        expect(queryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({ deleted_at: expect.any(String) })
        );
      });
    });

    describe('getFirmMembers', () => {
      it('should fetch members of a firm', async () => {
        const mockMembers = [
          {
            id: 'member-1',
            firm_id: 'firm-123',
            user_id: 'user-1',
            role: 'owner',
            title: 'Partner',
            permissions: {},
            joined_at: '2024-01-01',
            invited_by: null,
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
            profiles: {
              id: 'user-1',
              email: 'test@example.com',
              first_name: 'Test',
              last_name: 'User',
              avatar_url: null,
            },
          },
        ];
        const queryBuilder = createMockQueryBuilder(mockMembers);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.getFirmMembers('firm-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('firm_members');
        expect(queryBuilder.eq).toHaveBeenCalledWith('firm_id', 'firm-123');
        expect(result).toHaveLength(1);
        expect(result[0].role).toBe('owner');
      });
    });

    describe('getFirmMember', () => {
      it('should fetch a specific firm member', async () => {
        const mockMember = {
          id: 'member-1',
          firm_id: 'firm-123',
          user_id: 'user-123',
          role: 'attorney',
          title: null,
          permissions: {},
          joined_at: '2024-01-01',
          invited_by: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          profiles: {
            id: 'user-123',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            avatar_url: null,
          },
        };
        const queryBuilder = createMockQueryBuilder([mockMember]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.getFirmMember('firm-123', 'user-123');

        expect(queryBuilder.eq).toHaveBeenCalledWith('firm_id', 'firm-123');
        expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(result).not.toBeNull();
      });
    });

    describe('updateFirmMember', () => {
      it('should update a firm member', async () => {
        const updatedMember = {
          id: 'member-1',
          firm_id: 'firm-123',
          user_id: 'user-123',
          role: 'admin',
          title: 'Manager',
          permissions: { manage_cases: true },
          joined_at: '2024-01-01',
          invited_by: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          profiles: null,
        };
        const queryBuilder = createMockQueryBuilder([updatedMember]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.updateFirmMember('firm-123', 'user-123', {
          role: 'admin',
          title: 'Manager',
        });

        expect(queryBuilder.update).toHaveBeenCalledWith({
          role: 'admin',
          title: 'Manager',
        });
        expect(result.role).toBe('admin');
      });
    });

    describe('removeFirmMember', () => {
      it('should remove a firm member', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockReturnThis();
        mockSupabase.from.mockReturnValue(queryBuilder);

        await firmsService.removeFirmMember('firm-123', 'user-123');

        expect(queryBuilder.delete).toHaveBeenCalled();
      });
    });

    describe('createInvitation', () => {
      it('should create an invitation', async () => {
        const mockInvitation = {
          id: 'inv-123',
          firm_id: 'firm-123',
          email: 'new@example.com',
          role: 'attorney',
          token: 'generated-token',
          status: 'pending',
          invited_by: 'user-123',
          accepted_by: null,
          expires_at: '2024-01-08',
          accepted_at: null,
          revoked_at: null,
          metadata: {},
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          firms: { id: 'firm-123', name: 'Test Firm', slug: 'test-firm' },
        };

        mockSupabase.rpc.mockResolvedValue({ data: 'generated-token', error: null });
        const queryBuilder = createMockQueryBuilder([mockInvitation]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.createInvitation(
          'firm-123',
          'new@example.com',
          'attorney',
          'user-123'
        );

        expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_invitation_token');
        expect(queryBuilder.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            firm_id: 'firm-123',
            email: 'new@example.com',
            role: 'attorney',
            token: 'generated-token',
            invited_by: 'user-123',
          })
        );
        expect(result.email).toBe('new@example.com');
      });
    });

    describe('getInvitationByToken', () => {
      it('should fetch an invitation by token', async () => {
        const mockInvitation = {
          id: 'inv-123',
          firm_id: 'firm-123',
          email: 'new@example.com',
          role: 'attorney',
          token: 'test-token',
          status: 'pending',
          invited_by: 'user-123',
          accepted_by: null,
          expires_at: '2024-01-08',
          accepted_at: null,
          revoked_at: null,
          metadata: {},
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          firms: { id: 'firm-123', name: 'Test Firm', slug: 'test-firm' },
          inviter: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
        };
        const queryBuilder = createMockQueryBuilder([mockInvitation]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.getInvitationByToken('test-token');

        expect(queryBuilder.eq).toHaveBeenCalledWith('token', 'test-token');
        expect(result).not.toBeNull();
      });
    });

    describe('acceptInvitation', () => {
      it('should accept an invitation via RPC', async () => {
        const mockMember = {
          id: 'member-1',
          firm_id: 'firm-123',
          user_id: 'user-123',
          role: 'attorney',
          title: null,
          permissions: {},
          joined_at: '2024-01-01',
          invited_by: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          profiles: null,
        };
        mockSupabase.rpc.mockResolvedValue({ data: mockMember, error: null });

        const result = await firmsService.acceptInvitation('test-token', 'user-123');

        expect(mockSupabase.rpc).toHaveBeenCalledWith('accept_firm_invitation', {
          p_token: 'test-token',
          p_user_id: 'user-123',
        });
        expect(result).toBeDefined();
      });
    });

    describe('revokeInvitation', () => {
      it('should revoke an invitation', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
        mockSupabase.from.mockReturnValue(queryBuilder);

        await firmsService.revokeInvitation('inv-123');

        expect(queryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'revoked',
            revoked_at: expect.any(String),
          })
        );
      });
    });

    describe('getPendingInvitations', () => {
      it('should fetch pending invitations', async () => {
        const mockInvitations = [
          {
            id: 'inv-1',
            firm_id: 'firm-123',
            email: 'test1@example.com',
            role: 'attorney',
            token: 'token1',
            status: 'pending',
            invited_by: 'user-123',
            accepted_by: null,
            expires_at: '2024-01-08',
            accepted_at: null,
            revoked_at: null,
            metadata: {},
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
            inviter: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          },
        ];
        const queryBuilder = createMockQueryBuilder(mockInvitations);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await firmsService.getPendingInvitations('firm-123');

        expect(queryBuilder.eq).toHaveBeenCalledWith('firm_id', 'firm-123');
        expect(queryBuilder.eq).toHaveBeenCalledWith('status', 'pending');
        expect(result).toHaveLength(1);
      });
    });

    describe('getUserRole', () => {
      it('should get user role in a firm via RPC', async () => {
        mockSupabase.rpc.mockResolvedValue({ data: 'attorney', error: null });

        const result = await firmsService.getUserRole('user-123', 'firm-123');

        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_firm_role', {
          p_user_id: 'user-123',
          p_firm_id: 'firm-123',
        });
        expect(result).toBe('attorney');
      });

      it('should return null when user has no role', async () => {
        mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

        const result = await firmsService.getUserRole('user-123', 'firm-123');

        expect(result).toBeNull();
      });
    });
  });

  // ============================================================
  // SUBSCRIPTIONS SERVICE TESTS
  // ============================================================
  describe('subscriptionsService', () => {
    describe('getSubscriptionByUserId', () => {
      it('should fetch active subscription for a user', async () => {
        const mockSub = createMockSubscription();
        const queryBuilder = createMockQueryBuilder([mockSub]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await subscriptionsService.getSubscriptionByUserId('user-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
        expect(queryBuilder.eq).toHaveBeenCalledWith('customers.user_id', 'user-123');
        expect(queryBuilder.in).toHaveBeenCalledWith('status', ['trialing', 'active', 'past_due']);
        expect(result).not.toBeNull();
        expect(result?.planType).toBe('pro');
      });

      it('should return null when no active subscription', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await subscriptionsService.getSubscriptionByUserId('user-123');

        expect(result).toBeNull();
      });
    });

    describe('getAllPlanLimits', () => {
      it('should fetch all plan limits', async () => {
        const mockLimits = [
          {
            plan_type: 'free',
            max_cases: 3,
            max_documents_per_case: 10,
            max_ai_requests_per_month: 25,
            max_storage_gb: 1,
            max_team_members: 1,
            features: { document_analysis: true },
          },
          {
            plan_type: 'pro',
            max_cases: 100,
            max_documents_per_case: 50,
            max_ai_requests_per_month: 500,
            max_storage_gb: 10,
            max_team_members: 5,
            features: { document_analysis: true, form_autofill: true },
          },
        ];
        const queryBuilder = createMockQueryBuilder(mockLimits);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await subscriptionsService.getAllPlanLimits();

        expect(mockSupabase.from).toHaveBeenCalledWith('plan_limits');
        expect(result).toHaveLength(2);
        expect(result[0].planType).toBe('free');
      });
    });

    describe('getPlanLimits', () => {
      it('should fetch limits for a specific plan', async () => {
        const mockLimits = {
          plan_type: 'pro',
          max_cases: 100,
          max_documents_per_case: 50,
          max_ai_requests_per_month: 500,
          max_storage_gb: 10,
          max_team_members: 5,
          features: { document_analysis: true, form_autofill: true },
        };
        const queryBuilder = createMockQueryBuilder([mockLimits]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await subscriptionsService.getPlanLimits('pro');

        expect(queryBuilder.eq).toHaveBeenCalledWith('plan_type', 'pro');
        expect(result).not.toBeNull();
        expect(result?.maxCases).toBe(100);
      });

      it('should return null when plan not found', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        queryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await subscriptionsService.getPlanLimits('nonexistent' as 'free');

        expect(result).toBeNull();
      });
    });

    describe('getUserPlanLimits', () => {
      it('should return user plan limits based on subscription', async () => {
        const mockSub = createMockSubscription({ plan_type: 'pro' });
        const mockLimits = {
          plan_type: 'pro',
          max_cases: 100,
          max_documents_per_case: 50,
          max_ai_requests_per_month: 500,
          max_storage_gb: 10,
          max_team_members: 5,
          features: { document_analysis: true, form_autofill: true },
        };

        const subQueryBuilder = createMockQueryBuilder([mockSub]);
        const limitsQueryBuilder = createMockQueryBuilder([mockLimits]);

        mockSupabase.from
          .mockReturnValueOnce(subQueryBuilder)
          .mockReturnValueOnce(limitsQueryBuilder);

        const result = await subscriptionsService.getUserPlanLimits('user-123');

        expect(result.planType).toBe('pro');
        expect(result.maxCases).toBe(100);
      });

      it('should return free tier defaults when no subscription', async () => {
        const subQueryBuilder = createMockQueryBuilder([]);
        subQueryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });

        const limitsQueryBuilder = createMockQueryBuilder([]);
        limitsQueryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });

        mockSupabase.from
          .mockReturnValueOnce(subQueryBuilder)
          .mockReturnValueOnce(limitsQueryBuilder);

        const result = await subscriptionsService.getUserPlanLimits('user-123');

        expect(result.planType).toBe('free');
        expect(result.maxCases).toBe(5);
        expect(result.features.documentAnalysis).toBe(true);
        expect(result.features.formAutofill).toBe(false);
      });
    });

    describe('getCurrentUsage', () => {
      it('should fetch current usage via RPC', async () => {
        const mockUsage = [
          { metric_name: 'cases', quantity: 5 },
          { metric_name: 'ai_requests', quantity: 50 },
        ];
        mockSupabase.rpc.mockResolvedValue({ data: mockUsage, error: null });

        const result = await subscriptionsService.getCurrentUsage('user-123');

        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_current_usage', {
          p_subscription_id: 'user-123',
        });
        expect(result.cases).toBe(5);
        expect(result.ai_requests).toBe(50);
      });

      it('should return empty object on error', async () => {
        mockSupabase.rpc.mockResolvedValue({
          data: null,
          error: { message: 'RPC failed' },
        });

        const result = await subscriptionsService.getCurrentUsage('user-123');

        expect(result).toEqual({});
      });
    });

    describe('incrementUsage', () => {
      it('should increment usage for a metric', async () => {
        const mockSub = createMockSubscription();
        const subQueryBuilder = createMockQueryBuilder([mockSub]);
        mockSupabase.from.mockReturnValue(subQueryBuilder);
        mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

        await subscriptionsService.incrementUsage('user-123', 'ai_requests', 1);

        expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_usage', {
          p_subscription_id: mockSub.id,
          p_metric_name: 'ai_requests',
          p_quantity: 1,
        });
      });

      it('should do nothing when no subscription', async () => {
        const subQueryBuilder = createMockQueryBuilder([]);
        subQueryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
        mockSupabase.from.mockReturnValue(subQueryBuilder);

        await subscriptionsService.incrementUsage('user-123', 'ai_requests');

        expect(mockSupabase.rpc).not.toHaveBeenCalledWith(
          'increment_usage',
          expect.anything()
        );
      });
    });

    describe('checkQuota', () => {
      it('should check if user has remaining quota', async () => {
        mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

        const result = await subscriptionsService.checkQuota('user-123', 'ai_requests', 5);

        expect(mockSupabase.rpc).toHaveBeenCalledWith('check_quota', {
          p_user_id: 'user-123',
          p_metric_name: 'ai_requests',
          p_required_quantity: 5,
        });
        expect(result).toBe(true);
      });

      it('should return false when quota exceeded', async () => {
        mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

        const result = await subscriptionsService.checkQuota('user-123', 'ai_requests', 100);

        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        mockSupabase.rpc.mockResolvedValue({
          data: null,
          error: { message: 'RPC failed' },
        });

        const result = await subscriptionsService.checkQuota('user-123', 'ai_requests');

        expect(result).toBe(false);
      });
    });

    describe('getUserInvoices', () => {
      it('should fetch invoices for a user', async () => {
        const mockInvoices = [
          { id: 'inv-1', amount: 4900, status: 'paid', created_at: '2024-01-01' },
          { id: 'inv-2', amount: 4900, status: 'paid', created_at: '2023-12-01' },
        ];
        const queryBuilder = createMockQueryBuilder(mockInvoices);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await subscriptionsService.getUserInvoices('user-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('invoices');
        expect(queryBuilder.eq).toHaveBeenCalledWith('customers.user_id', 'user-123');
        expect(queryBuilder.limit).toHaveBeenCalledWith(10);
        expect(result).toHaveLength(2);
      });

      it('should use custom limit', async () => {
        const queryBuilder = createMockQueryBuilder([]);
        mockSupabase.from.mockReturnValue(queryBuilder);

        await subscriptionsService.getUserInvoices('user-123', 5);

        expect(queryBuilder.limit).toHaveBeenCalledWith(5);
      });
    });

    describe('getUserPayments', () => {
      it('should fetch payments for a user', async () => {
        const mockPayments = [
          { id: 'pay-1', amount: 4900, status: 'succeeded', created_at: '2024-01-01' },
        ];
        const queryBuilder = createMockQueryBuilder(mockPayments);
        mockSupabase.from.mockReturnValue(queryBuilder);

        const result = await subscriptionsService.getUserPayments('user-123');

        expect(mockSupabase.from).toHaveBeenCalledWith('payments');
        expect(queryBuilder.eq).toHaveBeenCalledWith('customers.user_id', 'user-123');
        expect(result).toHaveLength(1);
      });
    });
  });
});
