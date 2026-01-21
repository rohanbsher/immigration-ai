/**
 * Audit logging service for tracking all data changes.
 * Provides compliance-ready audit trails for immigration data.
 *
 * All changes to cases, documents, and forms are logged with:
 * - Who made the change
 * - What was changed (before/after values)
 * - When the change occurred
 * - What operation was performed
 */

import { createClient } from '@/lib/supabase/server';

export type AuditOperation = 'create' | 'update' | 'delete' | 'restore' | 'access' | 'export';

export type AuditTableName =
  | 'cases'
  | 'documents'
  | 'forms'
  | 'profiles'
  | 'clients'
  | 'notifications';

export interface AuditLogEntry {
  id: string;
  table_name: AuditTableName;
  record_id: string;
  operation: AuditOperation;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by: string;
  changed_at: string;
  ip_address?: string;
  user_agent?: string;
  additional_context?: Record<string, unknown>;
}

export interface CreateAuditLogData {
  table_name: AuditTableName;
  record_id: string;
  operation: AuditOperation;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string;
  user_agent?: string;
  additional_context?: Record<string, unknown>;
}

/**
 * Fields that should be redacted from audit logs for security.
 */
const REDACTED_FIELDS = [
  'password',
  'password_hash',
  'api_key',
  'secret',
  'token',
  'credit_card',
  'ssn',
  'social_security_number',
];

/**
 * Redact sensitive fields from data before logging.
 */
function redactSensitiveData(
  data: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!data) return null;

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = REDACTED_FIELDS.some((field) =>
      lowerKey.includes(field)
    );

    if (shouldRedact) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Compute the difference between old and new values.
 * Only includes fields that actually changed.
 */
function computeChangedFields(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): {
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
} {
  if (!oldValues || !newValues) {
    return {
      old: redactSensitiveData(oldValues),
      new: redactSensitiveData(newValues),
    };
  }

  const changedOld: Record<string, unknown> = {};
  const changedNew: Record<string, unknown> = {};

  // Find changed fields
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];

    // Skip internal fields that change on every update
    if (key === 'updated_at') continue;

    // Check if values are different
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changedOld[key] = oldVal;
      changedNew[key] = newVal;
    }
  }

  return {
    old: Object.keys(changedOld).length > 0 ? redactSensitiveData(changedOld) : null,
    new: Object.keys(changedNew).length > 0 ? redactSensitiveData(changedNew) : null,
  };
}

export const auditService = {
  /**
   * Create an audit log entry.
   */
  async log(data: CreateAuditLogData): Promise<AuditLogEntry | null> {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('Audit log: No user found');
        return null;
      }

      // Compute changed fields for updates
      const { old: oldValues, new: newValues } =
        data.operation === 'update'
          ? computeChangedFields(data.old_values ?? null, data.new_values ?? null)
          : {
              old: redactSensitiveData(data.old_values ?? null),
              new: redactSensitiveData(data.new_values ?? null),
            };

      // Skip if no actual changes for updates
      if (data.operation === 'update' && !oldValues && !newValues) {
        return null;
      }

      const { data: entry, error } = await supabase
        .from('audit_log')
        .insert({
          table_name: data.table_name,
          record_id: data.record_id,
          operation: data.operation,
          old_values: oldValues,
          new_values: newValues,
          changed_by: user.id,
          ip_address: data.ip_address,
          user_agent: data.user_agent,
          additional_context: data.additional_context,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create audit log:', error);
        return null;
      }

      return entry as AuditLogEntry;
    } catch (error) {
      console.error('Audit log error:', error);
      return null;
    }
  },

  /**
   * Log a create operation.
   */
  async logCreate(
    tableName: AuditTableName,
    recordId: string,
    newValues: Record<string, unknown>,
    context?: { ip_address?: string; user_agent?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      table_name: tableName,
      record_id: recordId,
      operation: 'create',
      new_values: newValues,
      ...context,
    });
  },

  /**
   * Log an update operation.
   */
  async logUpdate(
    tableName: AuditTableName,
    recordId: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    context?: { ip_address?: string; user_agent?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      table_name: tableName,
      record_id: recordId,
      operation: 'update',
      old_values: oldValues,
      new_values: newValues,
      ...context,
    });
  },

  /**
   * Log a delete operation.
   */
  async logDelete(
    tableName: AuditTableName,
    recordId: string,
    oldValues: Record<string, unknown>,
    context?: { ip_address?: string; user_agent?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      table_name: tableName,
      record_id: recordId,
      operation: 'delete',
      old_values: oldValues,
      ...context,
    });
  },

  /**
   * Log a restore operation (un-delete).
   */
  async logRestore(
    tableName: AuditTableName,
    recordId: string,
    context?: { ip_address?: string; user_agent?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      table_name: tableName,
      record_id: recordId,
      operation: 'restore',
      ...context,
    });
  },

  /**
   * Log a data access operation (for compliance tracking).
   */
  async logAccess(
    tableName: AuditTableName,
    recordId: string,
    context?: {
      ip_address?: string;
      user_agent?: string;
      additional_context?: Record<string, unknown>;
    }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      table_name: tableName,
      record_id: recordId,
      operation: 'access',
      ...context,
    });
  },

  /**
   * Log a data export operation.
   */
  async logExport(
    tableName: AuditTableName,
    recordId: string,
    exportDetails: Record<string, unknown>,
    context?: { ip_address?: string; user_agent?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      table_name: tableName,
      record_id: recordId,
      operation: 'export',
      additional_context: exportDetails,
      ...context,
    });
  },

  /**
   * Get audit log entries for a specific record.
   */
  async getLogsForRecord(
    tableName: AuditTableName,
    recordId: string,
    limit = 50
  ): Promise<AuditLogEntry[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }

    return data as AuditLogEntry[];
  },

  /**
   * Get audit log entries by user.
   */
  async getLogsByUser(userId: string, limit = 100): Promise<AuditLogEntry[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('changed_by', userId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }

    return data as AuditLogEntry[];
  },

  /**
   * Get recent audit log entries.
   */
  async getRecentLogs(limit = 100): Promise<AuditLogEntry[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }

    return data as AuditLogEntry[];
  },
};
