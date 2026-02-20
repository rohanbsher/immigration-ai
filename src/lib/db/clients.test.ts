import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockQueryBuilder,
  mockUser,
  resetMocks,
} from '@/__mocks__/supabase';

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

const mockAdminQueryBuilder = createMockQueryBuilder([]);
const mockAdminClient = {
  from: vi.fn().mockReturnValue(mockAdminQueryBuilder),
  auth: { admin: { createUser: vi.fn() } },
};

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(() => mockAdminClient),
}));

import { clientsService } from './clients';

const createMockProfile = (overrides = {}) => ({
  id: 'profile-123',
  email: 'test@example.com',
  role: 'client',
  first_name: 'Test',
  last_name: 'User',
  phone: '555-1234',
  date_of_birth: null,
  country_of_birth: null,
  nationality: null,
  avatar_url: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMockCase = (overrides = {}) => ({
  id: 'case-123',
  attorney_id: 'attorney-456',
  client_id: 'client-789',
  visa_type: 'H1B',
  status: 'intake',
  title: 'Test Case',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  ...overrides,
});

/**
 * Helper: set up admin client to resolve firm as null (no firm association).
 * Uses two calls: profiles (primary_firm_id) + firm_members fallback.
 */
function setupAdminNoFirm() {
  const noFirmProfileQB = createMockQueryBuilder([{ primary_firm_id: null }]);
  const noFirmMemberQB = createMockQueryBuilder([]);
  mockAdminClient.from
    .mockReturnValueOnce(noFirmProfileQB)
    .mockReturnValueOnce(noFirmMemberQB);
}

/**
 * Helper: set up admin client to resolve firm and return no firm-only clients.
 */
function setupAdminWithFirmNoClients(firmId = 'firm-abc') {
  const firmProfileQB = createMockQueryBuilder([{ primary_firm_id: firmId }]);
  const firmClientsQB = createMockQueryBuilder([]); // no caseless firm clients
  mockAdminClient.from
    .mockReturnValueOnce(firmProfileQB)
    .mockReturnValueOnce(firmClientsQB);
}

describe('ClientsService', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    mockAdminClient.from.mockReset();
  });

  describe('getClients', () => {
    it('should fetch clients with case counts aggregated from join', async () => {
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
      // getClients also calls resolveFirmId + firm client fetch via admin
      setupAdminWithFirmNoClients();

      const result = await clientsService.getClients({}, mockUser.id);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);

      const alice = result.data.find((c) => c.first_name === 'Alice');
      expect(alice?.cases_count).toBe(2);
      expect(alice?.active_cases_count).toBe(1); // intake is active, approved is not

      const bob = result.data.find((c) => c.first_name === 'Bob');
      expect(bob?.cases_count).toBe(1);
      expect(bob?.active_cases_count).toBe(1); // in_review is active
    });

    it('should return empty array when no cases exist', async () => {
      const casesQueryBuilder = createMockQueryBuilder([]);
      mockSupabase.from.mockReturnValue(casesQueryBuilder);
      setupAdminNoFirm();

      const result = await clientsService.getClients({}, mockUser.id);

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should sort clients alphabetically by first_name', async () => {
      const mockCasesWithClients = [
        {
          client_id: 'client-z',
          status: 'intake',
          client: createMockProfile({ id: 'client-z', first_name: 'Zara' }),
        },
        {
          client_id: 'client-a',
          status: 'intake',
          client: createMockProfile({ id: 'client-a', first_name: 'Anna' }),
        },
      ];

      const casesQueryBuilder = createMockQueryBuilder(mockCasesWithClients);
      mockSupabase.from.mockReturnValue(casesQueryBuilder);
      setupAdminWithFirmNoClients();

      const result = await clientsService.getClients({}, mockUser.id);

      expect(result.data[0].first_name).toBe('Anna');
      expect(result.data[1].first_name).toBe('Zara');
    });

    it('should filter by search query (case-insensitive)', async () => {
      const mockCasesWithClients = [
        {
          client_id: 'client-1',
          status: 'intake',
          client: createMockProfile({ id: 'client-1', first_name: 'Alice', last_name: 'Smith' }),
        },
        {
          client_id: 'client-2',
          status: 'intake',
          client: createMockProfile({ id: 'client-2', first_name: 'Bob', last_name: 'Jones' }),
        },
      ];

      const casesQueryBuilder = createMockQueryBuilder(mockCasesWithClients);
      mockSupabase.from.mockReturnValue(casesQueryBuilder);
      setupAdminWithFirmNoClients();

      const result = await clientsService.getClients({ search: 'alice' }, mockUser.id);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].first_name).toBe('Alice');
    });

    it('should search across first_name, last_name, and email', async () => {
      const mockCasesWithClients = [
        {
          client_id: 'client-1',
          status: 'intake',
          client: createMockProfile({
            id: 'client-1',
            first_name: 'Alice',
            last_name: 'Smith',
            email: 'alice@example.com',
          }),
        },
      ];

      const casesQueryBuilder = createMockQueryBuilder(mockCasesWithClients);
      mockSupabase.from.mockReturnValue(casesQueryBuilder);
      setupAdminWithFirmNoClients();

      // Search by email
      const result = await clientsService.getClients({ search: 'alice@' }, mockUser.id);
      expect(result.data).toHaveLength(1);
    });

    it('should apply pagination', async () => {
      const clients = Array.from({ length: 5 }, (_, i) => ({
        client_id: `client-${i}`,
        status: 'intake',
        client: createMockProfile({
          id: `client-${i}`,
          first_name: `Client${String.fromCharCode(65 + i)}`,
        }),
      }));

      const casesQueryBuilder = createMockQueryBuilder(clients);
      mockSupabase.from.mockReturnValue(casesQueryBuilder);
      setupAdminWithFirmNoClients();

      const result = await clientsService.getClients({ page: 2, limit: 2 }, mockUser.id);

      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(2);
    });

    it('should skip rows with null client data in join', async () => {
      const mockCasesWithClients = [
        {
          client_id: 'client-1',
          status: 'intake',
          client: null, // e.g., deleted profile
        },
        {
          client_id: 'client-2',
          status: 'intake',
          client: createMockProfile({ id: 'client-2', first_name: 'Bob' }),
        },
      ];

      const casesQueryBuilder = createMockQueryBuilder(mockCasesWithClients);
      mockSupabase.from.mockReturnValue(casesQueryBuilder);
      setupAdminWithFirmNoClients();

      const result = await clientsService.getClients({}, mockUser.id);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].first_name).toBe('Bob');
    });

    it('should correctly categorize active vs inactive case statuses', async () => {
      const mockCasesWithClients = [
        { client_id: 'c1', status: 'intake', client: createMockProfile({ id: 'c1', first_name: 'A' }) },
        { client_id: 'c1', status: 'in_review', client: createMockProfile({ id: 'c1', first_name: 'A' }) },
        { client_id: 'c1', status: 'closed', client: createMockProfile({ id: 'c1', first_name: 'A' }) },
        { client_id: 'c1', status: 'denied', client: createMockProfile({ id: 'c1', first_name: 'A' }) },
        { client_id: 'c1', status: 'approved', client: createMockProfile({ id: 'c1', first_name: 'A' }) },
      ];

      const casesQueryBuilder = createMockQueryBuilder(mockCasesWithClients);
      mockSupabase.from.mockReturnValue(casesQueryBuilder);
      setupAdminWithFirmNoClients();

      const result = await clientsService.getClients({}, mockUser.id);

      expect(result.data[0].cases_count).toBe(5);
      // intake and in_review are active; closed, denied, approved are inactive
      expect(result.data[0].active_cases_count).toBe(2);
    });

    it('should throw when Supabase query fails', async () => {
      const casesQueryBuilder = createMockQueryBuilder([]);
      casesQueryBuilder.is = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      mockSupabase.from.mockReturnValue(casesQueryBuilder);

      await expect(clientsService.getClients({}, mockUser.id)).rejects.toThrow();
    });
  });

  describe('getClientById', () => {
    it('should fetch client with case counts when cases exist', async () => {
      const mockCases = [
        { status: 'intake' },
        { status: 'approved' },
        { status: 'in_review' },
      ];
      const mockProfile = createMockProfile({ id: 'client-123' });

      const casesQueryBuilder = createMockQueryBuilder(mockCases);
      const profileQueryBuilder = createMockQueryBuilder([mockProfile]);

      mockSupabase.from
        .mockReturnValueOnce(casesQueryBuilder)
        .mockReturnValueOnce(profileQueryBuilder);

      const result = await clientsService.getClientById('client-123', mockUser.id);

      expect(result).not.toBeNull();
      expect(result?.cases_count).toBe(3);
      expect(result?.active_cases_count).toBe(2); // intake + in_review
    });

    it('should return null when no cases and no firm linkage', async () => {
      const casesQueryBuilder = createMockQueryBuilder([]);
      mockSupabase.from.mockReturnValueOnce(casesQueryBuilder);
      // getClientById also calls resolveFirmId via admin when no cases
      setupAdminNoFirm();

      const result = await clientsService.getClientById('non-existent', mockUser.id);

      expect(result).toBeNull();
    });

    it('should return null when profile fetch fails for case-linked client', async () => {
      const casesQueryBuilder = createMockQueryBuilder([{ status: 'intake' }]);
      const profileQueryBuilder = createMockQueryBuilder([]);
      profileQueryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      mockSupabase.from
        .mockReturnValueOnce(casesQueryBuilder)
        .mockReturnValueOnce(profileQueryBuilder);

      const result = await clientsService.getClientById('client-123', mockUser.id);

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
      expect(queryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
      expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no cases found', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await clientsService.getClientCases('client-123');

      expect(result).toEqual([]);
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
    it('should update client when cases link exists', async () => {
      const linkedCases = [{ id: 'case-1' }];
      const updatedProfile = createMockProfile({ first_name: 'Updated' });

      const casesQB = createMockQueryBuilder(linkedCases);
      const profilesQB = createMockQueryBuilder([updatedProfile]);

      mockSupabase.from
        .mockReturnValueOnce(casesQB)
        .mockReturnValueOnce(profilesQB);

      const result = await clientsService.updateClient(
        'client-123',
        { first_name: 'Updated', phone: '555-9999' },
        mockUser.id
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(profilesQB.update).toHaveBeenCalledWith({
        first_name: 'Updated',
        phone: '555-9999',
      });
      expect(result).toBeDefined();
    });

    it('should throw unauthorized when no cases and no firm link', async () => {
      const casesQB = createMockQueryBuilder([]);
      mockSupabase.from.mockReturnValueOnce(casesQB);

      // resolveFirmId: no firm
      const noFirmProfileQB = createMockQueryBuilder([{ primary_firm_id: null }]);
      const noFirmMemberQB = createMockQueryBuilder([]);
      mockAdminClient.from
        .mockReturnValueOnce(noFirmProfileQB)
        .mockReturnValueOnce(noFirmMemberQB);

      await expect(
        clientsService.updateClient('client-123', { first_name: 'X' }, mockUser.id)
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw error when profile update fails', async () => {
      const casesQB = createMockQueryBuilder([{ id: 'case-1' }]);
      const profilesQB = createMockQueryBuilder([]);
      profilesQB.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      mockSupabase.from
        .mockReturnValueOnce(casesQB)
        .mockReturnValueOnce(profilesQB);

      await expect(
        clientsService.updateClient('client-123', { first_name: 'X' }, mockUser.id)
      ).rejects.toThrow();
    });
  });

  describe('searchClients', () => {
    it('should return empty array for empty query', async () => {
      const result = await clientsService.searchClients('', mockUser.id);
      expect(result).toEqual([]);
    });

    it('should use firm-based search when firm exists', async () => {
      const firmCaseRows = [{ client_id: 'client-1' }];
      const matchedProfiles = [
        createMockProfile({ id: 'client-1', first_name: 'Test', role: 'client' }),
      ];

      const profileQB = createMockQueryBuilder([{ primary_firm_id: 'firm-abc' }]);
      const firmCasesQB = createMockQueryBuilder(firmCaseRows);
      const searchQB = createMockQueryBuilder(matchedProfiles);
      const caselessQB = createMockQueryBuilder([]);

      mockAdminClient.from
        .mockReturnValueOnce(profileQB)
        .mockReturnValueOnce(firmCasesQB)
        .mockReturnValueOnce(searchQB)
        .mockReturnValueOnce(caselessQB);

      const result = await clientsService.searchClients('Test', mockUser.id);

      expect(result).toHaveLength(1);
      expect(result[0].first_name).toBe('Test');
    });

    it('should include caseless firm clients in search results', async () => {
      const firmCaseRows = [{ client_id: 'client-1' }];
      const caseClients = [
        createMockProfile({ id: 'client-1', first_name: 'Existing', role: 'client' }),
      ];
      const caselessClients = [
        createMockProfile({ id: 'client-new', first_name: 'NewClient', role: 'client' }),
      ];

      const profileQB = createMockQueryBuilder([{ primary_firm_id: 'firm-abc' }]);
      const firmCasesQB = createMockQueryBuilder(firmCaseRows);
      const searchQB = createMockQueryBuilder(caseClients);
      const caselessQB = createMockQueryBuilder(caselessClients);

      mockAdminClient.from
        .mockReturnValueOnce(profileQB)
        .mockReturnValueOnce(firmCasesQB)
        .mockReturnValueOnce(searchQB)
        .mockReturnValueOnce(caselessQB);

      const result = await clientsService.searchClients('Client', mockUser.id);

      expect(result).toHaveLength(2);
    });

    it('should deduplicate clients appearing in both case and firm searches', async () => {
      const sharedClient = createMockProfile({
        id: 'client-1',
        first_name: 'Shared',
        role: 'client',
      });

      const profileQB = createMockQueryBuilder([{ primary_firm_id: 'firm-abc' }]);
      const firmCasesQB = createMockQueryBuilder([{ client_id: 'client-1' }]);
      const searchQB = createMockQueryBuilder([sharedClient]);
      const caselessQB = createMockQueryBuilder([sharedClient]); // same client

      mockAdminClient.from
        .mockReturnValueOnce(profileQB)
        .mockReturnValueOnce(firmCasesQB)
        .mockReturnValueOnce(searchQB)
        .mockReturnValueOnce(caselessQB);

      const result = await clientsService.searchClients('Shared', mockUser.id);

      expect(result).toHaveLength(1);
    });

    it('should fall back to case-based search when no firm found', async () => {
      // Admin: no firm
      const noFirmProfileQB = createMockQueryBuilder([{ primary_firm_id: null }]);
      const noFirmMemberQB = createMockQueryBuilder([]);

      mockAdminClient.from
        .mockReturnValueOnce(noFirmProfileQB)
        .mockReturnValueOnce(noFirmMemberQB);

      // Fallback: regular supabase
      const casesQB = createMockQueryBuilder([{ client_id: 'client-1' }]);
      const profilesQB = createMockQueryBuilder([
        createMockProfile({ id: 'client-1', first_name: 'Found' }),
      ]);

      mockSupabase.from
        .mockReturnValueOnce(casesQB)
        .mockReturnValueOnce(profilesQB);

      const result = await clientsService.searchClients('Found', mockUser.id);

      expect(result).toHaveLength(1);
      expect(result[0].first_name).toBe('Found');
    });

    it('should return empty when fallback finds no cases', async () => {
      const noFirmProfileQB = createMockQueryBuilder([{ primary_firm_id: null }]);
      const noFirmMemberQB = createMockQueryBuilder([]);
      mockAdminClient.from
        .mockReturnValueOnce(noFirmProfileQB)
        .mockReturnValueOnce(noFirmMemberQB);

      const casesQB = createMockQueryBuilder([]);
      mockSupabase.from.mockReturnValueOnce(casesQB);

      const result = await clientsService.searchClients('Nobody', mockUser.id);

      expect(result).toEqual([]);
    });

    it('should limit results to 10', async () => {
      const manyClients = Array.from({ length: 15 }, (_, i) => ({
        client_id: `client-${i}`,
      }));
      const manyProfiles = Array.from({ length: 15 }, (_, i) =>
        createMockProfile({ id: `client-${i}`, first_name: `Client${i}`, role: 'client' })
      );

      const profileQB = createMockQueryBuilder([{ primary_firm_id: 'firm-abc' }]);
      const firmCasesQB = createMockQueryBuilder(manyClients);
      const searchQB = createMockQueryBuilder(manyProfiles);
      const caselessQB = createMockQueryBuilder([]);

      mockAdminClient.from
        .mockReturnValueOnce(profileQB)
        .mockReturnValueOnce(firmCasesQB)
        .mockReturnValueOnce(searchQB)
        .mockReturnValueOnce(caselessQB);

      const result = await clientsService.searchClients('Client', mockUser.id);

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe('createClient', () => {
    it('should create auth user and return profile', async () => {
      const newUser = { id: 'new-user-id', email: 'new@example.com' };
      const newProfile = createMockProfile({ id: 'new-user-id', email: 'new@example.com' });

      mockAdminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: newUser },
        error: null,
      });

      // Profile fetch (retry loop)
      const profileQB = createMockQueryBuilder([newProfile]);
      // resolveFirmId for setting primary_firm_id (profile lookup)
      const firmProfileQB = createMockQueryBuilder([{ primary_firm_id: 'firm-abc' }]);
      // update profile with firm_id
      const updateQB = createMockQueryBuilder([]);

      mockAdminClient.from
        .mockReturnValueOnce(profileQB)    // fetch profile after user creation
        .mockReturnValueOnce(firmProfileQB) // resolveFirmId
        .mockReturnValueOnce(updateQB);     // update primary_firm_id

      const result = await clientsService.createClient(
        { email: 'new@example.com', first_name: 'New', last_name: 'Client' },
        'creator-user-id'
      );

      expect(result).toBeDefined();
      expect(result.email).toBe('new@example.com');
      expect(mockAdminClient.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          email_confirm: true,
          user_metadata: expect.objectContaining({
            first_name: 'New',
            last_name: 'Client',
            role: 'client',
          }),
        })
      );
    });

    it('should throw for duplicate email', async () => {
      mockAdminClient.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'User already been registered' },
      });

      await expect(
        clientsService.createClient({
          email: 'existing@example.com',
          first_name: 'Dup',
          last_name: 'User',
        })
      ).rejects.toThrow('A user with this email already exists');
    });

    it('should throw for generic auth errors', async () => {
      mockAdminClient.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'Internal server error' },
      });

      await expect(
        clientsService.createClient({
          email: 'test@example.com',
          first_name: 'T',
          last_name: 'U',
        })
      ).rejects.toThrow();
    });
  });
});
