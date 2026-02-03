import { describe, it, expect } from 'vitest';
import { isValidTransition, getValidNextStates, assertValidTransition, isTerminalState, TERMINAL_STATES } from './state-machine';

describe('Document State Machine', () => {
  describe('isValidTransition', () => {
    it('allows uploaded -> processing', () => {
      expect(isValidTransition('uploaded', 'processing')).toBe(true);
    });

    it('allows processing -> analyzed', () => {
      expect(isValidTransition('processing', 'analyzed')).toBe(true);
    });

    it('allows processing -> needs_review', () => {
      expect(isValidTransition('processing', 'needs_review')).toBe(true);
    });

    it('allows processing -> uploaded (error revert)', () => {
      expect(isValidTransition('processing', 'uploaded')).toBe(true);
    });

    it('allows analyzed -> verified for attorney', () => {
      expect(isValidTransition('analyzed', 'verified', 'attorney')).toBe(true);
    });

    it('blocks analyzed -> verified without attorney role', () => {
      expect(isValidTransition('analyzed', 'verified')).toBe(false);
      expect(isValidTransition('analyzed', 'verified', 'client')).toBe(false);
    });

    it('blocks verified -> any (terminal state)', () => {
      expect(isValidTransition('verified', 'processing')).toBe(false);
      expect(isValidTransition('verified', 'analyzed')).toBe(false);
    });

    it('blocks invalid transitions', () => {
      expect(isValidTransition('uploaded', 'verified')).toBe(false);
      expect(isValidTransition('analyzed', 'processing')).toBe(false);
    });
  });

  describe('getValidNextStates', () => {
    it('returns correct states for uploaded', () => {
      expect(getValidNextStates('uploaded')).toEqual(['processing', 'expired']);
    });

    it('returns correct states for processing', () => {
      expect(getValidNextStates('processing')).toEqual(['analyzed', 'needs_review', 'uploaded']);
    });

    it('returns correct states for analyzed', () => {
      expect(getValidNextStates('analyzed')).toEqual(['verified', 'rejected', 'expired']);
    });

    it('returns empty for terminal states', () => {
      expect(getValidNextStates('verified')).toEqual([]);
      expect(getValidNextStates('rejected')).toEqual([]);
      expect(getValidNextStates('expired')).toEqual([]);
    });
  });

  describe('assertValidTransition', () => {
    it('throws for invalid transition with helpful message', () => {
      expect(() => assertValidTransition('uploaded', 'verified'))
        .toThrow('Invalid status transition: uploaded -> verified. Valid next states: processing, expired');
    });

    it('does not throw for valid transition', () => {
      expect(() => assertValidTransition('uploaded', 'processing')).not.toThrow();
    });
  });

  describe('expired status', () => {
    it('allows uploaded → expired (system)', () => {
      expect(isValidTransition('uploaded', 'expired')).toBe(true);
    });

    it('allows analyzed → expired (system)', () => {
      expect(isValidTransition('analyzed', 'expired')).toBe(true);
    });

    it('allows needs_review → expired (system)', () => {
      expect(isValidTransition('needs_review', 'expired')).toBe(true);
    });

    it('blocks expired → any (terminal state)', () => {
      expect(isValidTransition('expired', 'processing')).toBe(false);
      expect(isValidTransition('expired', 'uploaded')).toBe(false);
      expect(isValidTransition('expired', 'verified')).toBe(false);
    });

    it('blocks processing → expired (mid-analysis)', () => {
      expect(isValidTransition('processing', 'expired')).toBe(false);
    });
  });

  describe('isTerminalState', () => {
    it('identifies verified as terminal', () => {
      expect(isTerminalState('verified')).toBe(true);
    });

    it('identifies rejected as terminal', () => {
      expect(isTerminalState('rejected')).toBe(true);
    });

    it('identifies expired as terminal', () => {
      expect(isTerminalState('expired')).toBe(true);
    });

    it('identifies non-terminal states correctly', () => {
      expect(isTerminalState('uploaded')).toBe(false);
      expect(isTerminalState('processing')).toBe(false);
      expect(isTerminalState('analyzed')).toBe(false);
      expect(isTerminalState('needs_review')).toBe(false);
    });
  });

  describe('TERMINAL_STATES', () => {
    it('includes all terminal states', () => {
      expect(TERMINAL_STATES).toContain('verified');
      expect(TERMINAL_STATES).toContain('rejected');
      expect(TERMINAL_STATES).toContain('expired');
      expect(TERMINAL_STATES).toHaveLength(3);
    });
  });
});
