/**
 * Canonical color map for case status values.
 *
 * These CSS hex colors are passed directly to chart libraries (Recharts, etc.)
 * rather than used as Tailwind classes. Keep this as the single source of truth
 * so that the dashboard and analytics pages render statuses consistently.
 */
export const STATUS_COLORS: Record<string, string> = {
  intake: '#94a3b8',
  document_collection: '#f59e0b',
  in_review: '#3b82f6',
  forms_preparation: '#8b5cf6',
  ready_for_filing: '#6366f1',
  filed: '#22c55e',
  pending_response: '#f97316',
  approved: '#10b981',
  denied: '#ef4444',
  closed: '#64748b',
};
