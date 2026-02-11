'use client';

import { useState, useCallback } from 'react';

const CONSENT_KEY = 'immigration-ai-ai-consent';
const CONSENT_VERSION = '1.0';

interface ConsentRecord {
  consented: boolean;
  timestamp: string;
  version: string;
}

function readConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed: ConsentRecord = JSON.parse(raw);
    return parsed.consented === true && parsed.version === CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function useAiConsent() {
  const [hasConsented, setHasConsented] = useState(readConsent);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const grantConsent = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/ai-consent', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to persist AI consent');
      }
    } catch {
      // Server persistence failed — still set localStorage as cache
      // The server will reject AI requests until consent is persisted
    }

    const record: ConsentRecord = {
      consented: true,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    setHasConsented(true);
    setShowConsentModal(false);
  }, []);

  const revokeConsent = useCallback(async () => {
    try {
      await fetch('/api/profile/ai-consent', { method: 'DELETE' });
    } catch {
      // Best effort
    }
    localStorage.removeItem(CONSENT_KEY);
    setHasConsented(false);
  }, []);

  const openConsentDialog = useCallback(() => {
    setShowConsentModal(true);
  }, []);

  const closeConsentDialog = useCallback(() => {
    setShowConsentModal(false);
  }, []);

  return {
    hasConsented,
    showConsentModal,
    grantConsent,
    revokeConsent,
    openConsentDialog,
    closeConsentDialog,
  };
}
