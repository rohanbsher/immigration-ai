'use client';

import { useState, useCallback } from 'react';

const CONSENT_KEY = 'immigration-ai-consent';

interface ConsentState {
  analytics: boolean;
  timestamp: string;
  version: string;
}

interface UseConsentReturn {
  analyticsConsented: boolean | null;
  consentLoaded: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
}

function readConsent(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed: ConsentState = JSON.parse(raw);
    return parsed.analytics;
  } catch {
    return null;
  }
}

function writeConsent(analytics: boolean): void {
  const state: ConsentState = {
    analytics,
    timestamp: new Date().toISOString(),
    version: '1.0',
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
}

export function useConsent(): UseConsentReturn {
  const [analyticsConsented, setAnalyticsConsented] = useState<boolean | null>(readConsent);
  const [consentLoaded] = useState(() => typeof window !== 'undefined');

  const acceptAll = useCallback(() => {
    writeConsent(true);
    setAnalyticsConsented(true);
  }, []);

  const rejectAll = useCallback(() => {
    writeConsent(false);
    setAnalyticsConsented(false);
  }, []);

  return { analyticsConsented, consentLoaded, acceptAll, rejectAll };
}
