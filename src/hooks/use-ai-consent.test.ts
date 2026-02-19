import { renderHook, act } from '@testing-library/react';
import { useAiConsent } from '@/hooks/use-ai-consent';

const mockParseApiVoidResponse = vi.fn();
vi.mock('@/lib/api/parse-response', () => ({
  parseApiVoidResponse: (...args: unknown[]) => mockParseApiVoidResponse(...args),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const CONSENT_KEY = 'immigration-ai-ai-consent';

describe('useAiConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
    mockParseApiVoidResponse.mockResolvedValue(undefined);
  });

  test('returns false when no consent in localStorage', () => {
    const { result } = renderHook(() => useAiConsent());
    expect(result.current.hasConsented).toBe(false);
  });

  test('returns true when valid consent with correct version 1.0', () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ consented: true, timestamp: new Date().toISOString(), version: '1.0' })
    );

    const { result } = renderHook(() => useAiConsent());
    expect(result.current.hasConsented).toBe(true);
  });

  test('returns false when version mismatch', () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ consented: true, timestamp: new Date().toISOString(), version: '0.9' })
    );

    const { result } = renderHook(() => useAiConsent());
    expect(result.current.hasConsented).toBe(false);
  });

  test('returns false on corrupted JSON', () => {
    localStorage.setItem(CONSENT_KEY, '{not valid json');

    const { result } = renderHook(() => useAiConsent());
    expect(result.current.hasConsented).toBe(false);
  });

  test('grantConsent POSTs, writes localStorage, and sets hasConsented true', async () => {
    const { result } = renderHook(() => useAiConsent());

    expect(result.current.hasConsented).toBe(false);

    await act(async () => {
      await result.current.grantConsent();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/profile/ai-consent', { method: 'POST' });
    expect(mockParseApiVoidResponse).toHaveBeenCalled();
    expect(result.current.hasConsented).toBe(true);

    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!);
    expect(stored.consented).toBe(true);
    expect(stored.version).toBe('1.0');
  });

  test('grantConsent with server failure still writes localStorage', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAiConsent());

    await act(async () => {
      await result.current.grantConsent();
    });

    expect(result.current.hasConsented).toBe(true);

    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY)!);
    expect(stored.consented).toBe(true);
    expect(stored.version).toBe('1.0');
  });

  test('revokeConsent DELETEs, removes localStorage, and sets hasConsented false', async () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ consented: true, timestamp: new Date().toISOString(), version: '1.0' })
    );

    const { result } = renderHook(() => useAiConsent());
    expect(result.current.hasConsented).toBe(true);

    await act(async () => {
      await result.current.revokeConsent();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/profile/ai-consent', { method: 'DELETE' });
    expect(result.current.hasConsented).toBe(false);
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
  });

  test('openConsentDialog sets showConsentModal true', () => {
    const { result } = renderHook(() => useAiConsent());
    expect(result.current.showConsentModal).toBe(false);

    act(() => {
      result.current.openConsentDialog();
    });

    expect(result.current.showConsentModal).toBe(true);
  });

  test('closeConsentDialog sets showConsentModal false', () => {
    const { result } = renderHook(() => useAiConsent());

    act(() => {
      result.current.openConsentDialog();
    });
    expect(result.current.showConsentModal).toBe(true);

    act(() => {
      result.current.closeConsentDialog();
    });
    expect(result.current.showConsentModal).toBe(false);
  });
});
