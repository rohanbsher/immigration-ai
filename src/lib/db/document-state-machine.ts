import type { DocumentStatus } from '@/types';

interface StatusTransition {
  from: DocumentStatus[];
  to: DocumentStatus;
  requiresRole?: 'attorney';
}

const VALID_TRANSITIONS: StatusTransition[] = [
  { from: ['uploaded'], to: 'processing' },
  { from: ['processing'], to: 'analyzed' },
  { from: ['processing'], to: 'needs_review' },
  { from: ['processing'], to: 'uploaded' },  // Revert on error
  { from: ['analyzed', 'needs_review'], to: 'verified', requiresRole: 'attorney' },
  { from: ['analyzed', 'needs_review'], to: 'rejected', requiresRole: 'attorney' },
  // Documents can expire from any non-terminal state (triggered by system/cron)
  { from: ['uploaded', 'analyzed', 'needs_review'], to: 'expired' },
];

/**
 * Terminal states - documents in these states cannot transition to other states.
 */
export const TERMINAL_STATES: DocumentStatus[] = ['verified', 'rejected', 'expired'];

/**
 * Check if a status is a terminal state (no further transitions allowed).
 */
export function isTerminalState(status: DocumentStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

export function isValidTransition(
  from: DocumentStatus,
  to: DocumentStatus,
  userRole?: string
): boolean {
  const transition = VALID_TRANSITIONS.find(t =>
    t.from.includes(from) && t.to === to
  );

  if (!transition) return false;
  if (transition.requiresRole && userRole !== transition.requiresRole) return false;

  return true;
}

export function getValidNextStates(current: DocumentStatus): DocumentStatus[] {
  return VALID_TRANSITIONS
    .filter(t => t.from.includes(current))
    .map(t => t.to);
}

export function assertValidTransition(
  from: DocumentStatus,
  to: DocumentStatus,
  userRole?: string
): void {
  if (!isValidTransition(from, to, userRole)) {
    const validNext = getValidNextStates(from);
    throw new Error(
      `Invalid status transition: ${from} -> ${to}. ` +
      `Valid next states: ${validNext.length > 0 ? validNext.join(', ') : 'none (terminal state)'}`
    );
  }
}
