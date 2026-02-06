import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { createMockChain, createMockSupabaseFrom } from '@/test-utils/mock-supabase-chain';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('./processing-times', () => ({
  getProcessingTime: vi.fn().mockReturnValue({
    formType: 'I-485',
    minDays: 240,
    maxDays: 730,
    medianDays: 485,
    unit: 'months',
    lastUpdated: '2026-01-01',
  }),
  formatProcessingTime: vi.fn().mockReturnValue('8-24 months'),
}));

import {
  ALERT_THRESHOLDS,
  calculateSeverity,
  getSeverityColors,
  calculateCaseDeadlines,
  getUpcomingDeadlines,
  acknowledgeAlert,
  snoozeAlert,
} from './index';

// ---------------------------------------------------------------------------
// ALERT_THRESHOLDS constant
// ---------------------------------------------------------------------------
describe('ALERT_THRESHOLDS', () => {
  it('has expected threshold values', () => {
    expect(ALERT_THRESHOLDS).toEqual({
      critical: 7,
      warning: 30,
      info: 60,
    });
  });
});

// ---------------------------------------------------------------------------
// calculateSeverity - pure function
// ---------------------------------------------------------------------------
describe('calculateSeverity', () => {
  it('returns critical when daysRemaining is 5 (within critical threshold)', () => {
    expect(calculateSeverity(5)).toBe('critical');
  });

  it('returns critical at boundary daysRemaining=7', () => {
    expect(calculateSeverity(7)).toBe('critical');
  });

  it('returns warning when daysRemaining is 8 (just past critical)', () => {
    expect(calculateSeverity(8)).toBe('warning');
  });

  it('returns warning at boundary daysRemaining=30', () => {
    expect(calculateSeverity(30)).toBe('warning');
  });

  it('returns info when daysRemaining is 31 (just past warning)', () => {
    expect(calculateSeverity(31)).toBe('info');
  });

  it('returns info for large daysRemaining values', () => {
    expect(calculateSeverity(100)).toBe('info');
  });

  it('returns critical for negative daysRemaining (past due)', () => {
    expect(calculateSeverity(-5)).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// getSeverityColors - pure function
// ---------------------------------------------------------------------------
describe('getSeverityColors', () => {
  it('returns red palette for critical severity', () => {
    expect(getSeverityColors('critical')).toEqual({
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      dot: 'bg-red-500',
    });
  });

  it('returns yellow palette for warning severity', () => {
    expect(getSeverityColors('warning')).toEqual({
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      dot: 'bg-yellow-500',
    });
  });

  it('returns blue palette for info severity', () => {
    expect(getSeverityColors('info')).toEqual({
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      dot: 'bg-blue-500',
    });
  });
});

// ---------------------------------------------------------------------------
// Async tests that require Supabase mock
// ---------------------------------------------------------------------------
describe('calculateCaseDeadlines', () => {
  const mockSupabase = createMockSupabaseFrom();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );
  });

  it('returns case_deadline alert when deadline is within 60 days', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);

    const caseData = {
      id: 'case-1',
      attorney_id: 'attorney-1',
      deadline: futureDate.toISOString(),
      title: 'H-1B Application',
      visa_type: 'H-1B',
      client: [{ first_name: 'Jane', last_name: 'Doe' }],
    };

    // Chain for cases query (.single() terminates)
    const casesChain = createMockChain({ data: caseData, error: null });
    // Chain for documents query (thenable, no .single())
    const docsChain = createMockChain({ data: [], error: null });
    // Chain for forms query (thenable, no .single())
    const formsChain = createMockChain({ data: [], error: null });

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') return casesChain;
      if (table === 'documents') return docsChain;
      if (table === 'forms') return formsChain;
      callCount++;
      return createMockChain({ data: null, error: null });
    });

    const alerts = await calculateCaseDeadlines('case-1');

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const caseAlert = alerts.find((a) => a.alertType === 'case_deadline');
    expect(caseAlert).toBeDefined();
    expect(caseAlert!.caseId).toBe('case-1');
    expect(caseAlert!.userId).toBe('attorney-1');
    expect(caseAlert!.severity).toBe('warning'); // 20 days = warning
    expect(caseAlert!.caseInfo).toEqual({
      title: 'H-1B Application',
      visaType: 'H-1B',
      clientName: 'Jane Doe',
    });
  });

  it('returns empty alerts when case has no deadline', async () => {
    const caseData = {
      id: 'case-2',
      attorney_id: 'attorney-1',
      deadline: null,
      title: 'L-1 Transfer',
      visa_type: 'L-1',
      client: [{ first_name: 'John', last_name: 'Smith' }],
    };

    const casesChain = createMockChain({ data: caseData, error: null });
    const docsChain = createMockChain({ data: [], error: null });
    const formsChain = createMockChain({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') return casesChain;
      if (table === 'documents') return docsChain;
      if (table === 'forms') return formsChain;
      return createMockChain({ data: null, error: null });
    });

    const alerts = await calculateCaseDeadlines('case-2');

    const caseAlert = alerts.find((a) => a.alertType === 'case_deadline');
    expect(caseAlert).toBeUndefined();
  });

  it('returns empty array when case is not found', async () => {
    const casesChain = createMockChain({ data: null, error: null });

    mockSupabase.from.mockReturnValue(casesChain);

    const alerts = await calculateCaseDeadlines('nonexistent');
    expect(alerts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// acknowledgeAlert - async, mock Supabase update
// ---------------------------------------------------------------------------
describe('acknowledgeAlert', () => {
  const mockSupabase = createMockSupabaseFrom();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );
  });

  it('returns true on successful acknowledgement', async () => {
    const chain = createMockChain({ data: null, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const result = await acknowledgeAlert('alert-1', 'user-1');
    expect(result).toBe(true);

    expect(mockSupabase.from).toHaveBeenCalledWith('deadline_alerts');
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ acknowledged: true }),
    );
  });

  it('returns false when update errors', async () => {
    const chain = createMockChain({ data: null, error: { message: 'not found' } });
    // acknowledgeAlert awaits the chain after .eq(), so make the chain thenable with error
    // The chain.then already resolves with resolvedValue, but acknowledgeAlert
    // destructures { error } from the await, so we need the thenable to return { error }.
    mockSupabase.from.mockReturnValue(chain);

    const result = await acknowledgeAlert('alert-x', 'user-1');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// snoozeAlert - async, mock Supabase update
// ---------------------------------------------------------------------------
describe('snoozeAlert', () => {
  const mockSupabase = createMockSupabaseFrom();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );
  });

  it('returns true on successful snooze', async () => {
    const chain = createMockChain({ data: null, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const result = await snoozeAlert('alert-1', 'user-1', 3);
    expect(result).toBe(true);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ snoozed_until: expect.any(String) }),
    );
  });

  it('defaults snoozeDays to 1 when not provided', async () => {
    const chain = createMockChain({ data: null, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const before = new Date();
    const result = await snoozeAlert('alert-1', 'user-1');
    const after = new Date();
    expect(result).toBe(true);

    // Verify update was called with a snoozed_until ~ 1 day from now
    const updateArg = vi.mocked(chain.update).mock.calls[0][0] as {
      snoozed_until: string;
    };
    const snoozeDate = new Date(updateArg.snoozed_until);
    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + 1);
    const expectedMax = new Date(after);
    expectedMax.setDate(expectedMax.getDate() + 1);

    expect(snoozeDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime() - 1000);
    expect(snoozeDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime() + 1000);
  });
});

// ---------------------------------------------------------------------------
// getUpcomingDeadlines - async, mock Supabase query
// ---------------------------------------------------------------------------
describe('getUpcomingDeadlines', () => {
  const mockSupabase = createMockSupabaseFrom();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );
  });

  it('returns mapped alerts from database rows', async () => {
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 10);

    const dbAlerts = [
      {
        id: 'db-alert-1',
        case_id: 'case-1',
        user_id: 'user-1',
        alert_type: 'case_deadline',
        deadline_date: deadlineDate.toISOString().split('T')[0],
        severity: 'warning',
        message: 'Case deadline in 10 days',
        acknowledged: false,
        acknowledged_at: null,
        snoozed_until: null,
        created_at: new Date().toISOString(),
        case: {
          title: 'EB-2 NIW',
          visa_type: 'EB-2',
          client: { first_name: 'Alice', last_name: 'Wong' },
        },
      },
    ];

    const chain = createMockChain({ data: dbAlerts, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const alerts = await getUpcomingDeadlines('user-1');

    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('db-alert-1');
    expect(alerts[0].caseId).toBe('case-1');
    expect(alerts[0].alertType).toBe('case_deadline');
    expect(alerts[0].caseInfo).toEqual({
      title: 'EB-2 NIW',
      visaType: 'EB-2',
      clientName: 'Alice Wong',
    });
  });

  it('returns empty array when no alerts exist', async () => {
    const chain = createMockChain({ data: null, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const alerts = await getUpcomingDeadlines('user-no-alerts');
    expect(alerts).toEqual([]);
  });
});
