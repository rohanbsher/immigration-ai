'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const DRAFT_PREFIX = 'form-draft:';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_DEBOUNCE_MS = 30_000;

interface DraftEnvelope {
  data: Record<string, unknown>;
  savedAt: number;
}

interface UseFormAutoSaveOptions {
  formId: string;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseFormAutoSaveReturn {
  hasDraft: boolean;
  draftAge: string | null;
  saveDraft: (data: Record<string, unknown>) => void;
  restoreDraft: () => Record<string, unknown> | null;
  clearDraft: () => void;
  lastSavedAt: Date | null;
}

function storageKey(formId: string): string {
  return `${DRAFT_PREFIX}${formId}`;
}

function readDraft(formId: string): DraftEnvelope | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(formId));
    if (!raw) return null;
    const envelope: DraftEnvelope = JSON.parse(raw);
    if (Date.now() - envelope.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(storageKey(formId));
      return null;
    }
    return envelope;
  } catch {
    return null;
  }
}

function writeDraft(formId: string, data: Record<string, unknown>): number {
  const now = Date.now();
  const envelope: DraftEnvelope = { data, savedAt: now };
  localStorage.setItem(storageKey(formId), JSON.stringify(envelope));
  return now;
}

function formatDraftAge(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return 'over a day ago';
}

export function useFormAutoSave({
  formId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  enabled = true,
}: UseFormAutoSaveOptions): UseFormAutoSaveReturn {
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => {
    const existing = readDraft(formId);
    return existing?.savedAt ?? null;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Reset state when formId changes (useState initializer only runs on mount).
  // Reading localStorage is an external store sync — suppress the set-state-in-effect rule.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const existing = readDraft(formId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading external store (localStorage) on key change
    setLastSavedAt(existing?.savedAt ?? null);
  }, [formId]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const saveDraft = useCallback(
    (data: Record<string, unknown>) => {
      if (!enabledRef.current) return;
      if (typeof window === 'undefined') return;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        try {
          const ts = writeDraft(formId, data);
          setLastSavedAt(ts);
        } catch {
          // localStorage quota exceeded or private browsing -- silently skip
        }
      }, debounceMs);
    },
    [formId, debounceMs],
  );

  const restoreDraft = useCallback((): Record<string, unknown> | null => {
    const envelope = readDraft(formId);
    return envelope?.data ?? null;
  }, [formId]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(storageKey(formId));
    } catch {
      // ignore
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setLastSavedAt(null);
  }, [formId]);

  const hasDraft = lastSavedAt !== null;
  const draftAge = lastSavedAt !== null ? formatDraftAge(lastSavedAt) : null;

  return {
    hasDraft,
    draftAge,
    saveDraft,
    restoreDraft,
    clearDraft,
    lastSavedAt: lastSavedAt !== null ? new Date(lastSavedAt) : null,
  };
}
