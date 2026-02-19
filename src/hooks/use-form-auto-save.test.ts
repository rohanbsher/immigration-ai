import { renderHook, act } from '@testing-library/react';
import { useFormAutoSave } from '@/hooks/use-form-auto-save';

const DRAFT_PREFIX = 'form-draft:';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

describe('useFormAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  test('hasDraft is false when no draft exists', () => {
    const { result } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1' })
    );
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.lastSavedAt).toBeNull();
    expect(result.current.draftAge).toBeNull();
  });

  test('hasDraft is true when valid draft exists in localStorage', () => {
    const savedAt = Date.now() - 5000;
    localStorage.setItem(
      `${DRAFT_PREFIX}form-1`,
      JSON.stringify({ data: { field: 'value' }, savedAt })
    );

    const { result } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1' })
    );
    expect(result.current.hasDraft).toBe(true);
    expect(result.current.lastSavedAt).toEqual(new Date(savedAt));
  });

  test('expired drafts (>24h) are treated as no draft and removed', () => {
    const expiredAt = Date.now() - TWENTY_FOUR_HOURS - 1000;
    localStorage.setItem(
      `${DRAFT_PREFIX}form-1`,
      JSON.stringify({ data: { field: 'old' }, savedAt: expiredAt })
    );

    const { result } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1' })
    );
    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(`${DRAFT_PREFIX}form-1`)).toBeNull();
  });

  test('saveDraft debounces and does not write until timer fires', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1', debounceMs: 1000 })
    );

    act(() => {
      result.current.saveDraft({ name: 'test' });
    });

    // Not written yet
    expect(localStorage.getItem(`${DRAFT_PREFIX}form-1`)).toBeNull();
    expect(result.current.hasDraft).toBe(false);

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(localStorage.getItem(`${DRAFT_PREFIX}form-1`)).not.toBeNull();
    expect(result.current.hasDraft).toBe(true);
  });

  test('saveDraft with enabled=false does nothing', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1', debounceMs: 100, enabled: false })
    );

    act(() => {
      result.current.saveDraft({ name: 'test' });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(localStorage.getItem(`${DRAFT_PREFIX}form-1`)).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  test('restoreDraft returns data for valid draft', () => {
    const savedAt = Date.now() - 5000;
    const draftData = { firstName: 'Jane', lastName: 'Doe' };
    localStorage.setItem(
      `${DRAFT_PREFIX}form-1`,
      JSON.stringify({ data: draftData, savedAt })
    );

    const { result } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1' })
    );

    let restored: Record<string, unknown> | null = null;
    act(() => {
      restored = result.current.restoreDraft();
    });

    expect(restored).toEqual(draftData);
  });

  test('restoreDraft returns null when no draft exists', () => {
    const { result } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1' })
    );

    let restored: Record<string, unknown> | null = null;
    act(() => {
      restored = result.current.restoreDraft();
    });

    expect(restored).toBeNull();
  });

  test('clearDraft removes from localStorage and sets hasDraft false', () => {
    vi.useFakeTimers();
    const savedAt = Date.now() - 5000;
    localStorage.setItem(
      `${DRAFT_PREFIX}form-1`,
      JSON.stringify({ data: { field: 'value' }, savedAt })
    );

    const { result } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1' })
    );

    expect(result.current.hasDraft).toBe(true);

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(`${DRAFT_PREFIX}form-1`)).toBeNull();
  });

  test('draftAge returns correct relative time strings', () => {
    vi.useFakeTimers();
    const now = Date.now();

    // "just now" - saved less than 60 seconds ago
    localStorage.setItem(
      `${DRAFT_PREFIX}form-1`,
      JSON.stringify({ data: {}, savedAt: now - 10_000 })
    );
    const { result: r1 } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1' })
    );
    expect(r1.current.draftAge).toBe('just now');

    // "X minutes ago"
    localStorage.setItem(
      `${DRAFT_PREFIX}form-2`,
      JSON.stringify({ data: {}, savedAt: now - 5 * 60 * 1000 })
    );
    const { result: r2 } = renderHook(() =>
      useFormAutoSave({ formId: 'form-2' })
    );
    expect(r2.current.draftAge).toBe('5 minutes ago');

    // "1 minute ago" (singular)
    localStorage.setItem(
      `${DRAFT_PREFIX}form-3`,
      JSON.stringify({ data: {}, savedAt: now - 90 * 1000 })
    );
    const { result: r3 } = renderHook(() =>
      useFormAutoSave({ formId: 'form-3' })
    );
    expect(r3.current.draftAge).toBe('1 minute ago');

    // "X hours ago"
    localStorage.setItem(
      `${DRAFT_PREFIX}form-4`,
      JSON.stringify({ data: {}, savedAt: now - 3 * 60 * 60 * 1000 })
    );
    const { result: r4 } = renderHook(() =>
      useFormAutoSave({ formId: 'form-4' })
    );
    expect(r4.current.draftAge).toBe('3 hours ago');

    // "1 hour ago" (singular)
    localStorage.setItem(
      `${DRAFT_PREFIX}form-5`,
      JSON.stringify({ data: {}, savedAt: now - 60 * 60 * 1000 })
    );
    const { result: r5 } = renderHook(() =>
      useFormAutoSave({ formId: 'form-5' })
    );
    expect(r5.current.draftAge).toBe('1 hour ago');
  });

  test('changing formId resets state', () => {
    vi.useFakeTimers();
    const now = Date.now();

    localStorage.setItem(
      `${DRAFT_PREFIX}form-1`,
      JSON.stringify({ data: { name: 'form1' }, savedAt: now - 1000 })
    );

    const { result, rerender } = renderHook(
      ({ formId }: { formId: string }) => useFormAutoSave({ formId }),
      { initialProps: { formId: 'form-1' } }
    );

    expect(result.current.hasDraft).toBe(true);

    // Change to a formId with no draft
    rerender({ formId: 'form-999' });

    expect(result.current.hasDraft).toBe(false);
    expect(result.current.lastSavedAt).toBeNull();
  });

  test('timer cleanup on unmount prevents localStorage write', () => {
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() =>
      useFormAutoSave({ formId: 'form-1', debounceMs: 1000 })
    );

    act(() => {
      result.current.saveDraft({ name: 'test' });
    });

    // Unmount before timer fires
    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Nothing should have been written
    expect(localStorage.getItem(`${DRAFT_PREFIX}form-1`)).toBeNull();
  });
});
