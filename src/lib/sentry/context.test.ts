import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';

vi.mock('@sentry/nextjs', () => ({
  setUser: vi.fn(),
  setTag: vi.fn(),
  setExtra: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn().mockReturnValue('test-event-id'),
  captureMessage: vi.fn().mockReturnValue('test-message-id'),
  startInactiveSpan: vi.fn().mockReturnValue({ end: vi.fn() }),
}));

import {
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  captureError,
  captureMessage,
  setTag,
  setExtra,
  startTransaction,
} from './context';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// setUserContext
// ---------------------------------------------------------------------------
describe('setUserContext', () => {
  it('sets user with full context including role and firmId tags', () => {
    setUserContext({
      id: 'user-1',
      email: 'attorney@firm.com',
      role: 'attorney',
      firmId: 'firm-abc',
    });

    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'attorney@firm.com',
    });
    expect(Sentry.setTag).toHaveBeenCalledWith('user.role', 'attorney');
    expect(Sentry.setTag).toHaveBeenCalledWith('firm.id', 'firm-abc');
  });

  it('does not set role tag when role is not provided', () => {
    setUserContext({
      id: 'user-2',
      email: 'client@example.com',
    });

    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: 'user-2',
      email: 'client@example.com',
    });
    expect(Sentry.setTag).not.toHaveBeenCalledWith('user.role', expect.anything());
  });

  it('does not set firmId tag when firmId is not provided', () => {
    setUserContext({
      id: 'user-3',
      role: 'client',
    });

    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: 'user-3',
      email: undefined,
    });
    expect(Sentry.setTag).toHaveBeenCalledWith('user.role', 'client');
    expect(Sentry.setTag).not.toHaveBeenCalledWith('firm.id', expect.anything());
  });

  it('calls Sentry.setUser(null) when passed null', () => {
    setUserContext(null);

    expect(Sentry.setUser).toHaveBeenCalledWith(null);
    expect(Sentry.setTag).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearUserContext
// ---------------------------------------------------------------------------
describe('clearUserContext', () => {
  it('clears user and resets role and firmId tags', () => {
    clearUserContext();

    expect(Sentry.setUser).toHaveBeenCalledWith(null);
    expect(Sentry.setTag).toHaveBeenCalledWith('user.role', undefined);
    expect(Sentry.setTag).toHaveBeenCalledWith('firm.id', undefined);
  });
});

// ---------------------------------------------------------------------------
// addBreadcrumb
// ---------------------------------------------------------------------------
describe('addBreadcrumb', () => {
  it('passes message, category, data, and level to Sentry.addBreadcrumb', () => {
    const data = { formType: 'I-130', step: 3 };
    addBreadcrumb('Submitted form', 'form', data, 'warning');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'Submitted form',
      category: 'form',
      data,
      level: 'warning',
      timestamp: expect.any(Number),
    });
  });

  it('defaults level to info when not specified', () => {
    addBreadcrumb('Navigated to dashboard', 'navigation');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Navigated to dashboard',
        category: 'navigation',
        level: 'info',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// captureError
// ---------------------------------------------------------------------------
describe('captureError', () => {
  it('calls Sentry.captureException with error and extra context', () => {
    const error = new Error('Something failed');
    const context = { action: 'createCase', visaType: 'H-1B' };

    const eventId = captureError(error, context);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: context,
    });
    expect(eventId).toBe('test-event-id');
  });

  it('returns the event ID from Sentry', () => {
    const result = captureError(new Error('test'));
    expect(result).toBe('test-event-id');
  });
});

// ---------------------------------------------------------------------------
// captureMessage
// ---------------------------------------------------------------------------
describe('captureMessage', () => {
  it('calls Sentry.captureMessage with message, level, and extra context', () => {
    const context = { userId: 'user-1' };
    const msgId = captureMessage('User upgraded plan', 'info', context);

    expect(Sentry.captureMessage).toHaveBeenCalledWith('User upgraded plan', {
      level: 'info',
      extra: context,
    });
    expect(msgId).toBe('test-message-id');
  });

  it('returns the message ID from Sentry', () => {
    const result = captureMessage('test message');
    expect(result).toBe('test-message-id');
  });
});

// ---------------------------------------------------------------------------
// setTag / setExtra
// ---------------------------------------------------------------------------
describe('setTag', () => {
  it('delegates to Sentry.setTag', () => {
    setTag('environment', 'production');
    expect(Sentry.setTag).toHaveBeenCalledWith('environment', 'production');
  });
});

describe('setExtra', () => {
  it('delegates to Sentry.setExtra', () => {
    setExtra('requestPayload', { caseId: 'case-1' });
    expect(Sentry.setExtra).toHaveBeenCalledWith('requestPayload', {
      caseId: 'case-1',
    });
  });
});

// ---------------------------------------------------------------------------
// startTransaction
// ---------------------------------------------------------------------------
describe('startTransaction', () => {
  it('calls Sentry.startInactiveSpan with name and op', () => {
    const span = startTransaction('processCase', 'task');

    expect(Sentry.startInactiveSpan).toHaveBeenCalledWith({
      name: 'processCase',
      op: 'task',
    });
    expect(span).toBeDefined();
    expect(span).toHaveProperty('end');
  });
});
