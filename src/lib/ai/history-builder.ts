import type {
  AddressHistoryEntry,
  EmploymentHistoryEntry,
  EducationHistoryEntry,
} from '@/types';

interface ExtractedFieldEntry {
  field_name: string;
  value: string | null;
  [key: string]: unknown;
}

interface DocumentAnalysis {
  extracted_fields?: ExtractedFieldEntry[];
  document_type?: string;
  [key: string]: unknown;
}

/**
 * Build address history from utility bills, leases, and tax returns.
 * Sorts by from_date descending (most recent first, as USCIS requires).
 */
export function buildAddressHistory(
  documents: DocumentAnalysis[]
): AddressHistoryEntry[] {
  const entries: AddressHistoryEntry[] = [];

  for (const doc of documents) {
    if (!doc.extracted_fields) continue;
    const fields = toFieldMap(doc.extracted_fields);

    // Utility bills / leases have service_address_* fields
    if (fields.service_address_street) {
      entries.push({
        street: fields.service_address_street,
        apt: fields.service_address_apt || undefined,
        city: fields.service_address_city || '',
        state: fields.service_address_state || '',
        zip: fields.service_address_zip || '',
        country: fields.service_address_country || 'United States',
        from_date: fields.service_start_date?.slice(0, 7) || fields.bill_date?.slice(0, 7) || '',
        to_date: fields.service_end_date?.slice(0, 7) || 'present',
      });
    }

    // Tax returns have filing_address_* fields
    if (fields.filing_address_street) {
      entries.push({
        street: fields.filing_address_street,
        city: fields.filing_address_city || '',
        state: fields.filing_address_state || '',
        zip: fields.filing_address_zip || '',
        country: 'United States',
        from_date: fields.tax_year ? `${fields.tax_year}-01` : '',
        to_date: fields.tax_year ? `${fields.tax_year}-12` : '',
      });
    }
  }

  return deduplicateAndSort(entries, addressKey);
}

/**
 * Build employment history from W-2s, pay stubs, and employment letters.
 */
export function buildEmploymentHistory(
  documents: DocumentAnalysis[]
): EmploymentHistoryEntry[] {
  const entries: EmploymentHistoryEntry[] = [];

  for (const doc of documents) {
    if (!doc.extracted_fields) continue;
    const fields = toFieldMap(doc.extracted_fields);

    if (fields.employer_name) {
      entries.push({
        employer_name: fields.employer_name,
        employer_address: fields.employer_address || undefined,
        employer_city: fields.employer_city || undefined,
        employer_state: fields.employer_state || undefined,
        employer_zip: fields.employer_zip || undefined,
        employer_country: fields.employer_country || undefined,
        job_title: fields.job_title || fields.occupation || '',
        from_date: fields.employment_start_date || (fields.tax_year ? `${fields.tax_year}-01` : ''),
        to_date: fields.employment_end_date || 'present',
      });
    }
  }

  return deduplicateAndSort(entries, employerKey);
}

/**
 * Build education history from diplomas and transcripts.
 */
export function buildEducationHistory(
  documents: DocumentAnalysis[]
): EducationHistoryEntry[] {
  const entries: EducationHistoryEntry[] = [];

  for (const doc of documents) {
    if (!doc.extracted_fields) continue;
    const fields = toFieldMap(doc.extracted_fields);

    if (fields.institution_name && (fields.degree_type || fields.degree_program)) {
      entries.push({
        institution_name: fields.institution_name,
        institution_city: fields.institution_city || undefined,
        institution_state: fields.institution_state || undefined,
        institution_country: fields.institution_country || undefined,
        degree_type: fields.degree_type || fields.degree_program || '',
        field_of_study: fields.field_of_study || fields.major || '',
        graduation_date: fields.graduation_date?.slice(0, 7) || '',
        gpa: fields.cumulative_gpa || fields.gpa || undefined,
      });
    }
  }

  return entries.sort((a, b) => b.graduation_date.localeCompare(a.graduation_date));
}

/** Convert extracted_fields array to a flat Record for easy access. */
function toFieldMap(fields: ExtractedFieldEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) {
    if (f.value) map[f.field_name] = f.value;
  }
  return map;
}

/** Generate a dedup key for addresses (ignoring dates). */
function addressKey(entry: AddressHistoryEntry): string {
  return `${entry.street}|${entry.city}|${entry.state}`.toLowerCase();
}

/** Generate a dedup key for employers (ignoring dates). */
function employerKey(entry: EmploymentHistoryEntry): string {
  return `${entry.employer_name}|${entry.job_title}`.toLowerCase();
}

/** Deduplicate entries and sort by from_date descending. */
function deduplicateAndSort<T extends { from_date: string; to_date: string }>(
  entries: T[],
  keyFn: (entry: T) => string
): T[] {
  const seen = new Map<string, T>();
  for (const entry of entries) {
    const key = keyFn(entry);
    const existing = seen.get(key);
    if (!existing || entry.from_date < existing.from_date) {
      seen.set(key, entry);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.from_date.localeCompare(a.from_date));
}
