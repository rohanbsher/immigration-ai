/**
 * Billing-related types shared across the application.
 * Single source of truth for usage data structures.
 */

export interface UsageData {
  cases: number;
  /**
   * Max documents in any single case (per-case semantic).
   * Not displayed in aggregate UsageMeter - only shown in per-case views.
   */
  documents: number;
  aiRequests: number;
  teamMembers: number;
}
