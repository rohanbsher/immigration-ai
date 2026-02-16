/**
 * Deadline Alert System
 *
 * Calculates and manages deadline alerts for cases and documents.
 */

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getProcessingTime, formatProcessingTime } from './processing-times';
import { formatDocumentType } from '@/lib/ai/utils';

/**
 * Deadline alert structure.
 */
export interface DeadlineAlert {
  id: string;
  caseId: string;
  userId: string;
  alertType: 'case_deadline' | 'document_expiry' | 'processing_estimate';
  deadlineDate: Date;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  daysRemaining: number;
  acknowledged: boolean;
  acknowledgedAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
  // Optional case info for display
  caseInfo?: {
    title: string;
    visaType: string;
    clientName: string;
  };
}

/**
 * Alert severity thresholds (in days).
 */
export const ALERT_THRESHOLDS = {
  critical: 7,
  warning: 30,
  info: 60,
} as const;

/**
 * Calculate severity based on days remaining.
 */
export function calculateSeverity(daysRemaining: number): DeadlineAlert['severity'] {
  if (daysRemaining <= ALERT_THRESHOLDS.critical) return 'critical';
  if (daysRemaining <= ALERT_THRESHOLDS.warning) return 'warning';
  return 'info';
}

/**
 * Calculate days between two dates.
 * When a timezone is provided, normalizes both dates to that timezone's
 * midnight for accurate day-boundary calculations.
 */
function daysBetween(date1: Date, date2: Date, timezone?: string): number {
  const oneDay = 24 * 60 * 60 * 1000;

  if (timezone) {
    // Normalize to the user's timezone for accurate day boundaries.
    // Without this, a deadline at midnight PST calculated from a UTC server
    // could be off by a day.
    const d1 = getDateInTimezone(date1, timezone);
    const d2 = getDateInTimezone(date2, timezone);
    return Math.ceil((d2.getTime() - d1.getTime()) / oneDay);
  }

  return Math.ceil((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Get a Date normalized to midnight in a specific timezone.
 * Uses Intl.DateTimeFormat to extract date components in the target timezone,
 * then creates a UTC date at midnight for that timezone-local date.
 */
function getDateInTimezone(date: Date, timezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    return new Date(Date.UTC(year, month - 1, day));
  } catch {
    // Invalid timezone — fall back to UTC
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}

/**
 * Look up the user's timezone from notification preferences.
 * Falls back to 'America/New_York' (the DB default) if not found.
 * Accepts an optional Supabase client to avoid creating a new one per call.
 */
async function getUserTimezone(
  userId: string,
  supabase?: SupabaseClient
): Promise<string> {
  const client = supabase || await createClient();
  const { data } = await client
    .from('notification_preferences')
    .select('timezone')
    .eq('user_id', userId)
    .single();

  return data?.timezone || 'America/New_York';
}

/**
 * Calculate deadline alerts for a specific case.
 *
 * @param caseId - The case ID
 * @returns Array of deadline alerts
 */
export async function calculateCaseDeadlines(
  caseId: string,
  timezone?: string
): Promise<DeadlineAlert[]> {
  const supabase = await createClient();
  const now = new Date();
  const alerts: DeadlineAlert[] = [];

  // Fetch case details
  const { data: caseData } = await supabase
    .from('cases')
    .select(`
      id,
      attorney_id,
      deadline,
      title,
      visa_type,
      client:profiles!cases_client_id_fkey(first_name, last_name)
    `)
    .eq('id', caseId)
    .is('deleted_at', null)
    .single();

  if (!caseData) return alerts;

  // Handle client data - Supabase returns array for joins even with single()
  const clientArr = caseData.client as unknown as Array<{ first_name: string; last_name: string }> | null;
  const clientData = clientArr?.[0];
  const clientName = clientData
    ? `${clientData.first_name} ${clientData.last_name}`
    : 'Unknown Client';

  // Resolve timezone: use provided timezone, or look up from user preferences.
  // Pass the existing Supabase client to avoid creating a redundant one.
  const tz = timezone || await getUserTimezone(caseData.attorney_id, supabase);

  // 1. Case deadline alert
  if (caseData.deadline) {
    const deadlineDate = new Date(caseData.deadline);
    const daysRemaining = daysBetween(now, deadlineDate, tz);

    if (daysRemaining <= ALERT_THRESHOLDS.info && daysRemaining >= -30) {
      alerts.push({
        id: `case_deadline_${caseId}`,
        caseId,
        userId: caseData.attorney_id,
        alertType: 'case_deadline',
        deadlineDate,
        severity: calculateSeverity(daysRemaining),
        message:
          daysRemaining < 0
            ? `Case deadline passed ${Math.abs(daysRemaining)} days ago`
            : daysRemaining === 0
            ? 'Case deadline is today!'
            : `Case deadline in ${daysRemaining} days`,
        daysRemaining,
        acknowledged: false,
        acknowledgedAt: null,
        snoozedUntil: null,
        createdAt: now,
        caseInfo: {
          title: caseData.title,
          visaType: caseData.visa_type,
          clientName,
        },
      });
    }
  }

  // 2. Document expiration alerts
  const { data: documents } = await supabase
    .from('documents')
    .select('id, document_type, expiration_date')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .not('expiration_date', 'is', null);

  for (const doc of documents || []) {
    if (!doc.expiration_date) continue;

    const expirationDate = new Date(doc.expiration_date);
    const daysRemaining = daysBetween(now, expirationDate, tz);

    if (daysRemaining <= ALERT_THRESHOLDS.info && daysRemaining >= -30) {
      const docTypeName = formatDocumentType(doc.document_type);
      alerts.push({
        id: `doc_expiry_${caseId}_${doc.id}`,
        caseId,
        userId: caseData.attorney_id,
        alertType: 'document_expiry',
        deadlineDate: expirationDate,
        severity: calculateSeverity(daysRemaining),
        message:
          daysRemaining < 0
            ? `${docTypeName} expired ${Math.abs(daysRemaining)} days ago`
            : daysRemaining === 0
            ? `${docTypeName} expires today!`
            : `${docTypeName} expires in ${daysRemaining} days`,
        daysRemaining,
        acknowledged: false,
        acknowledgedAt: null,
        snoozedUntil: null,
        createdAt: now,
        caseInfo: {
          title: caseData.title,
          visaType: caseData.visa_type,
          clientName,
        },
      });
    }
  }

  // 3. Processing estimate alerts for filed forms
  const { data: forms } = await supabase
    .from('forms')
    .select('id, form_type, filed_at')
    .eq('case_id', caseId)
    .eq('status', 'filed')
    .not('filed_at', 'is', null);

  for (const form of forms || []) {
    if (!form.filed_at) continue;

    const filedDate = new Date(form.filed_at);
    const processingTime = getProcessingTime(form.form_type);

    // Estimate based on median processing time
    const estimatedDate = new Date(filedDate);
    estimatedDate.setDate(estimatedDate.getDate() + processingTime.medianDays);

    const daysUntilEstimate = daysBetween(now, estimatedDate, tz);

    // Only alert if we're approaching or past the median estimate
    if (daysUntilEstimate <= ALERT_THRESHOLDS.warning) {
      alerts.push({
        id: `processing_${caseId}_${form.id}`,
        caseId,
        userId: caseData.attorney_id,
        alertType: 'processing_estimate',
        deadlineDate: estimatedDate,
        severity: daysUntilEstimate <= 0 ? 'warning' : 'info',
        message:
          daysUntilEstimate <= 0
            ? `${form.form_type} may be ready for decision (filed ${formatProcessingTime(processingTime)} ago)`
            : `${form.form_type} estimated decision in ~${daysUntilEstimate} days`,
        daysRemaining: daysUntilEstimate,
        acknowledged: false,
        acknowledgedAt: null,
        snoozedUntil: null,
        createdAt: now,
        caseInfo: {
          title: caseData.title,
          visaType: caseData.visa_type,
          clientName,
        },
      });
    }
  }

  return alerts;
}

/**
 * Get all upcoming deadlines for a user.
 *
 * @param userId - The user ID
 * @param days - Number of days to look ahead (default 60)
 * @returns Array of deadline alerts
 */
export async function getUpcomingDeadlines(
  userId: string,
  days: number = 60
): Promise<DeadlineAlert[]> {
  const supabase = await createClient();
  const now = new Date();
  const tz = await getUserTimezone(userId, supabase);
  const cutoffDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Fetch existing alerts from database
  const { data: dbAlerts } = await supabase
    .from('deadline_alerts')
    .select(`
      *,
      case:cases!deadline_alerts_case_id_fkey(
        title,
        visa_type,
        client:profiles!cases_client_id_fkey(first_name, last_name)
      )
    `)
    .eq('user_id', userId)
    .lte('deadline_date', cutoffDate.toISOString().split('T')[0])
    .gte('deadline_date', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .or('snoozed_until.is.null,snoozed_until.lte.' + now.toISOString())
    .order('deadline_date', { ascending: true });

  if (!dbAlerts) return [];

  return dbAlerts.map((alert) => {
    const deadlineDate = new Date(alert.deadline_date);
    const daysRemaining = daysBetween(now, deadlineDate, tz);
    const clientName = alert.case?.client
      ? `${alert.case.client.first_name} ${alert.case.client.last_name}`
      : 'Unknown';

    return {
      id: alert.id,
      caseId: alert.case_id,
      userId: alert.user_id,
      alertType: alert.alert_type as DeadlineAlert['alertType'],
      deadlineDate,
      severity: alert.severity as DeadlineAlert['severity'],
      message: alert.message,
      daysRemaining,
      acknowledged: alert.acknowledged,
      acknowledgedAt: alert.acknowledged_at ? new Date(alert.acknowledged_at) : null,
      snoozedUntil: alert.snoozed_until ? new Date(alert.snoozed_until) : null,
      createdAt: new Date(alert.created_at),
      caseInfo: alert.case
        ? {
            title: alert.case.title,
            visaType: alert.case.visa_type,
            clientName,
          }
        : undefined,
    };
  });
}

/**
 * Acknowledge a deadline alert.
 *
 * @param alertId - The alert ID
 * @param userId - The user ID (for verification)
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('deadline_alerts')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Snooze a deadline alert.
 *
 * @param alertId - The alert ID
 * @param userId - The user ID (for verification)
 * @param snoozeDays - Number of days to snooze
 */
export async function snoozeAlert(
  alertId: string,
  userId: string,
  snoozeDays: number = 1
): Promise<boolean> {
  const supabase = await createClient();

  const snoozeUntil = new Date();
  snoozeUntil.setDate(snoozeUntil.getDate() + snoozeDays);

  const { error } = await supabase
    .from('deadline_alerts')
    .update({
      snoozed_until: snoozeUntil.toISOString(),
    })
    .eq('id', alertId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Sync deadline alerts to database.
 * Called by cron job to update all alerts.
 *
 * @param caseId - Optional specific case ID to sync
 */
export async function syncDeadlineAlerts(caseId?: string): Promise<number> {
  const supabase = await createClient();
  let syncCount = 0;

  // Get cases to process (include attorney_id for timezone caching)
  let casesQuery = supabase
    .from('cases')
    .select('id, attorney_id')
    .is('deleted_at', null)
    .not('status', 'in', '("approved","denied","closed")');

  if (caseId) {
    casesQuery = casesQuery.eq('id', caseId);
  }

  const { data: cases } = await casesQuery;

  if (!cases) return 0;

  // Cache timezone lookups by attorney to avoid redundant DB queries.
  // An attorney with 50 cases would otherwise trigger 50 identical queries.
  // Deduplicate attorney IDs and resolve all in parallel.
  const uniqueAttorneyIds = [...new Set(
    cases.map(c => c.attorney_id).filter((id): id is string => !!id)
  )];
  const timezoneResults = await Promise.all(
    uniqueAttorneyIds.map(id => getUserTimezone(id, supabase))
  );
  const timezoneCache = new Map<string, string>();
  uniqueAttorneyIds.forEach((id, i) => timezoneCache.set(id, timezoneResults[i]));

  // Process cases in parallel batches to avoid overwhelming the DB.
  // Each batch resolves concurrently; batches run sequentially.
  const BATCH_SIZE = 10;
  for (let i = 0; i < cases.length; i += BATCH_SIZE) {
    const batch = cases.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(c => {
        const tz = c.attorney_id ? timezoneCache.get(c.attorney_id) : undefined;
        return calculateCaseDeadlines(c.id, tz);
      })
    );

    for (const alerts of batchResults) {
      for (const alert of alerts) {
        // Upsert alert (insert or update if exists)
        const { error } = await supabase.from('deadline_alerts').upsert(
          {
            case_id: alert.caseId,
            user_id: alert.userId,
            alert_type: alert.alertType,
            deadline_date: alert.deadlineDate.toISOString().split('T')[0],
            severity: alert.severity,
            message: alert.message,
          },
          {
            onConflict: 'case_id,alert_type,deadline_date',
          }
        );

        if (!error) syncCount++;
      }
    }
  }

  return syncCount;
}

/**
 * Format document type for display.
 */
/**
 * Get severity color configuration.
 */
export function getSeverityColors(severity: DeadlineAlert['severity']): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        dot: 'bg-yellow-500',
      };
    case 'info':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      };
  }
}

// Re-export processing times
export * from './processing-times';
