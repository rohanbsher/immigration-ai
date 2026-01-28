/**
 * USCIS Processing Time Estimates
 *
 * Default processing time estimates for various immigration forms.
 * These are approximate and vary by service center and time.
 */

/**
 * Processing time estimate structure.
 */
export interface ProcessingTimeEstimate {
  formType: string;
  minDays: number;
  maxDays: number;
  medianDays: number;
  unit: 'days' | 'months';
  lastUpdated: string;
}

/**
 * Default processing times (USCIS approximate estimates).
 * These should be periodically updated from USCIS website.
 */
export const DEFAULT_PROCESSING_TIMES: Record<string, ProcessingTimeEstimate> = {
  'I-130': {
    formType: 'I-130',
    minDays: 365,
    maxDays: 730,
    medianDays: 547,
    unit: 'months',
    lastUpdated: '2026-01-01',
  },
  'I-485': {
    formType: 'I-485',
    minDays: 240,
    maxDays: 730,
    medianDays: 485,
    unit: 'months',
    lastUpdated: '2026-01-01',
  },
  'I-765': {
    formType: 'I-765',
    minDays: 90,
    maxDays: 180,
    medianDays: 135,
    unit: 'months',
    lastUpdated: '2026-01-01',
  },
  'I-131': {
    formType: 'I-131',
    minDays: 90,
    maxDays: 180,
    medianDays: 135,
    unit: 'months',
    lastUpdated: '2026-01-01',
  },
  'I-140': {
    formType: 'I-140',
    minDays: 180,
    maxDays: 365,
    medianDays: 272,
    unit: 'months',
    lastUpdated: '2026-01-01',
  },
  'I-129': {
    formType: 'I-129',
    minDays: 30,
    maxDays: 180,
    medianDays: 105,
    unit: 'months',
    lastUpdated: '2026-01-01',
  },
  'I-539': {
    formType: 'I-539',
    minDays: 120,
    maxDays: 365,
    medianDays: 242,
    unit: 'months',
    lastUpdated: '2026-01-01',
  },
  'N-400': {
    formType: 'N-400',
    minDays: 365,
    maxDays: 730,
    medianDays: 547,
    unit: 'months',
    lastUpdated: '2026-01-01',
  },
  'DS-160': {
    formType: 'DS-160',
    minDays: 30,
    maxDays: 90,
    medianDays: 60,
    unit: 'days',
    lastUpdated: '2026-01-01',
  },
  'G-1145': {
    formType: 'G-1145',
    minDays: 0,
    maxDays: 0,
    medianDays: 0,
    unit: 'days',
    lastUpdated: '2026-01-01',
  },
  'I-20': {
    formType: 'I-20',
    minDays: 14,
    maxDays: 60,
    medianDays: 30,
    unit: 'days',
    lastUpdated: '2026-01-01',
  },
};

/**
 * Get processing time estimate for a form type.
 *
 * @param formType - The form type (e.g., 'I-485')
 * @returns Processing time estimate or default estimate
 */
export function getProcessingTime(formType: string): ProcessingTimeEstimate {
  const normalized = formType.toUpperCase().replace(/[^A-Z0-9-]/g, '');

  if (normalized in DEFAULT_PROCESSING_TIMES) {
    return DEFAULT_PROCESSING_TIMES[normalized];
  }

  // Default estimate for unknown forms
  return {
    formType: normalized,
    minDays: 90,
    maxDays: 365,
    medianDays: 180,
    unit: 'months',
    lastUpdated: '2026-01-01',
  };
}

/**
 * Format processing time for display.
 *
 * @param estimate - Processing time estimate
 * @returns Formatted string (e.g., "8-24 months")
 */
export function formatProcessingTime(estimate: ProcessingTimeEstimate): string {
  if (estimate.minDays === 0 && estimate.maxDays === 0) {
    return 'Immediate';
  }

  if (estimate.unit === 'days' || estimate.maxDays <= 90) {
    return `${estimate.minDays}-${estimate.maxDays} days`;
  }

  const minMonths = Math.round(estimate.minDays / 30);
  const maxMonths = Math.round(estimate.maxDays / 30);

  if (minMonths === maxMonths) {
    return `~${minMonths} months`;
  }

  return `${minMonths}-${maxMonths} months`;
}

/**
 * Calculate estimated completion date range.
 *
 * @param filedDate - Date the form was filed
 * @param formType - The form type
 * @returns Object with estimated min and max completion dates
 */
export function calculateEstimatedCompletion(
  filedDate: Date,
  formType: string
): { minDate: Date; maxDate: Date; medianDate: Date } {
  const estimate = getProcessingTime(formType);

  const minDate = new Date(filedDate);
  minDate.setDate(minDate.getDate() + estimate.minDays);

  const maxDate = new Date(filedDate);
  maxDate.setDate(maxDate.getDate() + estimate.maxDays);

  const medianDate = new Date(filedDate);
  medianDate.setDate(medianDate.getDate() + estimate.medianDays);

  return { minDate, maxDate, medianDate };
}
