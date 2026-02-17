import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConsent } from './use-consent';

const CONSENT_KEY = 'immigration-ai-consent';

function setStoredConsent(analytics: boolean) {
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ analytics, timestamp: new Date().toISOString(), version: '1.0' })
  );
}

describe('useConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns null when no consent stored in localStorage', () => {
    const { result } = renderHook(() => useConsent());
    expect(result.current.analyticsConsented).toBeNull();
  });

  test('returns stored true consent on first render (no flash)', () => {
    setStoredConsent(true);
    const { result } = renderHook(() => useConsent());
    expect(result.current.analyticsConsented).toBe(true);
  });

  test('returns stored false consent on first render', () => {
    setStoredConsent(false);
    const { result } = renderHook(() => useConsent());
    expect(result.current.analyticsConsented).toBe(false);
  });

  test('acceptAll writes to localStorage and updates state to true', () => {
    const { result } = renderHook(() => useConsent());
    expect(result.current.analyticsConsented).toBeNull();

    act(() => {
      result.current.acceptAll();
    });

    expect(result.current.analyticsConsented).toBe(true);
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!);
    expect(stored.analytics).toBe(true);
    expect(stored.version).toBe('1.0');
  });

  test('rejectAll writes to localStorage and updates state to false', () => {
    const { result } = renderHook(() => useConsent());

    act(() => {
      result.current.rejectAll();
    });

    expect(result.current.analyticsConsented).toBe(false);
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!);
    expect(stored.analytics).toBe(false);
  });

  test('handles corrupted localStorage gracefully (returns null)', () => {
    localStorage.setItem(CONSENT_KEY, '{not valid json!!!');
    const { result } = renderHook(() => useConsent());
    expect(result.current.analyticsConsented).toBeNull();
  });

  test('consentLoaded is true after mount', () => {
    // Note: jsdom runs useEffect synchronously so we can't observe the
    // initial false state here. The hydration fix (useState(false) + useEffect)
    // is verified by the build — not by this unit test.
    const { result } = renderHook(() => useConsent());
    expect(result.current.consentLoaded).toBe(true);
  });
});
