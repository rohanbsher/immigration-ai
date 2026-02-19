/**
 * Natural Language Case Search
 *
 * Uses Claude to parse natural language queries into structured filters,
 * then executes database queries to find matching cases.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';
import { features } from '@/lib/config';
import { sanitizeSearchInput } from '@/lib/db/search-utils';
import { callClaudeStructured } from './structured-output';
import { SearchInterpretationSchema } from './schemas';

/**
 * Resolve a Supabase client: use the provided one, or lazily import
 * the cookie-based server client (Next.js only).
 */
async function resolveClient(client?: SupabaseClient): Promise<SupabaseClient> {
  if (client) return client;
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

const log = createLogger('natural-search');

/**
 * Search interpretation from Claude.
 */
export interface SearchInterpretation {
  understood: string;
  filters: SearchFilters;
  sortBy?: 'relevance' | 'date' | 'deadline';
  confidence: number;
}

/**
 * Extracted search filters.
 */
export interface SearchFilters {
  visaType?: string[];
  status?: string[];
  dateRange?: {
    start?: string;
    end?: string;
    field?: 'created_at' | 'deadline' | 'updated_at';
  };
  documentMissing?: string[];
  documentPresent?: string[];
  clientName?: string;
  priority?: 'high' | 'medium' | 'low';
  hasDeadline?: boolean;
  textSearch?: string;
}

/**
 * Search result with case and match info.
 */
export interface SearchResult {
  case: {
    id: string;
    title: string;
    visaType: string;
    status: string;
    clientName: string;
    deadline: string | null;
    createdAt: string;
  };
  relevanceScore: number;
  matchReason: string;
}

/**
 * Complete search response.
 */
export interface SearchResponse {
  interpretation: SearchInterpretation;
  results: SearchResult[];
  totalCount: number;
  suggestions: string[];
}

/**
 * System prompt for search query parsing.
 */
const SEARCH_PARSE_PROMPT = `You are a search query parser for an immigration case management system.
Your task is to interpret natural language search queries and convert them to structured filters.

Available visa types: B1B2, F1, H1B, H4, L1, O1, EB1, EB2, EB3, EB5, I-130, I-485, I-765, I-131, N-400, other

Available case statuses: intake, document_collection, in_review, forms_preparation, ready_for_filing, filed, pending_response, approved, denied, closed

Available document types: passport, visa, i94, birth_certificate, marriage_certificate, divorce_certificate, employment_letter, pay_stub, tax_return, w2, bank_statement, photo, medical_exam, police_clearance, diploma, transcript, recommendation_letter, other

Parse the user's query into structured search filters. Only include fields that are relevant to the query.`;

/**
 * Parse a natural language search query using Claude.
 *
 * @param query - The user's search query
 * @returns Parsed interpretation with filters
 */
export async function parseSearchQuery(
  query: string
): Promise<SearchInterpretation> {
  // Handle simple/empty queries
  if (!query || query.trim().length < 2) {
    return {
      understood: 'All cases',
      filters: {},
      confidence: 1.0,
    };
  }

  // If Anthropic is not configured, fall back to text search
  if (!features.formAutofill) {
    return {
      understood: `Search for "${query}"`,
      filters: { textSearch: query },
      confidence: 0.3,
    };
  }

  try {
    const parsed = await callClaudeStructured({
      toolName: 'search_interpretation',
      toolDescription: 'Parse a natural language search query into structured immigration case filters.',
      schema: SearchInterpretationSchema,
      system: [
        {
          type: 'text' as const,
          text: SEARCH_PARSE_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      userMessage: `Parse this search query: "${query}"

Today's date is ${new Date().toISOString().split('T')[0]}.`,
    });

    return {
      understood: parsed.understood || query,
      filters: parsed.filters || {},
      sortBy: parsed.sortBy,
      confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    log.logError('Error parsing search query', error);

    // Fallback to simple text search
    return {
      understood: `Search for "${query}"`,
      filters: {
        textSearch: query,
      },
      confidence: 0.3,
    };
  }
}

/**
 * Execute search based on parsed filters.
 *
 * @param filters - Parsed search filters
 * @param userId - The user ID for access control
 * @returns Array of matching cases
 */
export async function executeSearch(
  filters: SearchFilters,
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<SearchResult[]> {
  const supabase = await resolveClient(supabaseClient);

  // Build base query
  let query = supabase
    .from('cases')
    .select(`
      id,
      title,
      visa_type,
      status,
      deadline,
      created_at,
      client:profiles!cases_client_id_fkey(first_name, last_name)
    `)
    .is('deleted_at', null)
    .or(`attorney_id.eq.${userId},client_id.eq.${userId}`);

  // Apply visa type filter
  if (filters.visaType && filters.visaType.length > 0) {
    query = query.in('visa_type', filters.visaType);
  }

  // Apply status filter
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  // Apply date range filter
  if (filters.dateRange) {
    const field = filters.dateRange.field || 'created_at';
    if (filters.dateRange.start) {
      query = query.gte(field, filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      query = query.lte(field, filters.dateRange.end);
    }
  }

  // Apply has deadline filter
  if (filters.hasDeadline === true) {
    query = query.not('deadline', 'is', null);
  } else if (filters.hasDeadline === false) {
    query = query.is('deadline', null);
  }

  // Apply text search
  if (filters.textSearch) {
    const sanitized = sanitizeSearchInput(filters.textSearch);
    if (sanitized.length > 0) {
      query = query.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
    }
  }

  // Execute query
  const { data: cases, error } = await query
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    log.logError('Search query error', error);
    throw new Error('Failed to execute search');
  }

  if (!cases) {
    return [];
  }

  // Process results
  let results: SearchResult[] = cases.map((c) => {
    const clientArr = c.client as unknown as Array<{ first_name: string; last_name: string }> | null;
    const client = clientArr?.[0];
    const clientName = client ? `${client.first_name} ${client.last_name}` : 'Unknown';

    return {
      case: {
        id: c.id,
        title: c.title,
        visaType: c.visa_type,
        status: c.status,
        clientName,
        deadline: c.deadline,
        createdAt: c.created_at,
      },
      relevanceScore: 1.0, // Will be adjusted based on additional filters
      matchReason: generateMatchReason(c, filters),
    };
  });

  // Filter by document requirements if specified
  if (filters.documentMissing || filters.documentPresent) {
    results = await filterByDocuments(results, filters, supabase);
  }

  // Filter by client name if specified
  if (filters.clientName) {
    const searchName = filters.clientName.toLowerCase();
    results = results.filter((r) =>
      r.case.clientName.toLowerCase().includes(searchName)
    );
  }

  return results;
}

/**
 * Filter results by document requirements.
 */
async function filterByDocuments(
  results: SearchResult[],
  filters: SearchFilters,
  supabase: SupabaseClient
): Promise<SearchResult[]> {
  const caseIds = results.map((r) => r.case.id);

  if (caseIds.length === 0) return results;

  // Get documents for all cases
  const { data: documents } = await supabase
    .from('documents')
    .select('case_id, document_type')
    .in('case_id', caseIds)
    .is('deleted_at', null);

  if (!documents) return results;

  // Group documents by case
  const docsByCase = new Map<string, Set<string>>();
  for (const doc of documents) {
    if (!docsByCase.has(doc.case_id)) {
      docsByCase.set(doc.case_id, new Set());
    }
    docsByCase.get(doc.case_id)!.add(doc.document_type);
  }

  // Filter results
  return results.filter((r) => {
    const caseDocs = docsByCase.get(r.case.id) || new Set();

    // Check missing documents
    if (filters.documentMissing) {
      for (const docType of filters.documentMissing) {
        if (caseDocs.has(docType)) {
          return false; // Document is present but should be missing
        }
      }
    }

    // Check present documents
    if (filters.documentPresent) {
      for (const docType of filters.documentPresent) {
        if (!caseDocs.has(docType)) {
          return false; // Document is missing but should be present
        }
      }
    }

    // Update match reason
    if (filters.documentMissing?.length) {
      r.matchReason = `Missing ${filters.documentMissing.join(', ')}`;
    }

    return true;
  });
}

/**
 * Generate match reason based on filters.
 */
function generateMatchReason(
  caseData: { visa_type: string; status: string },
  filters: SearchFilters
): string {
  const reasons: string[] = [];

  if (filters.visaType?.includes(caseData.visa_type)) {
    reasons.push(`Visa type: ${caseData.visa_type}`);
  }

  if (filters.status?.includes(caseData.status)) {
    reasons.push(`Status: ${caseData.status.replace('_', ' ')}`);
  }

  if (filters.textSearch) {
    reasons.push('Matches search text');
  }

  return reasons.length > 0 ? reasons.join(', ') : 'Matches query';
}

/**
 * Generate search suggestions based on results.
 */
export function generateSuggestions(
  query: string,
  interpretation: SearchInterpretation,
  resultCount: number
): string[] {
  const suggestions: string[] = [];

  if (resultCount === 0) {
    suggestions.push('Try broader search terms');
    if (interpretation.filters.visaType) {
      suggestions.push('Remove visa type filter');
    }
    if (interpretation.filters.status) {
      suggestions.push('Include more case statuses');
    }
  }

  if (interpretation.confidence < 0.7) {
    suggestions.push('Be more specific with your query');
  }

  // Related searches
  if (interpretation.filters.visaType?.includes('H1B')) {
    suggestions.push('Related: H-4 dependent cases');
  }

  if (interpretation.filters.documentMissing) {
    suggestions.push('Related: cases with expiring documents');
  }

  return suggestions.slice(0, 3);
}

/**
 * Perform full natural language search.
 *
 * @param query - User's search query
 * @param userId - User ID for access control
 * @returns Complete search response
 */
export async function naturalLanguageSearch(
  query: string,
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<SearchResponse> {
  // Parse the query
  const interpretation = await parseSearchQuery(query);

  // Execute search
  const results = await executeSearch(interpretation.filters, userId, supabaseClient);

  // Generate suggestions
  const suggestions = generateSuggestions(query, interpretation, results.length);

  return {
    interpretation,
    results,
    totalCount: results.length,
    suggestions,
  };
}
