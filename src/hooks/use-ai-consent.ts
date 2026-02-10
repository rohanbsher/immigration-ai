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

  const grantConsent = useCallback(() => {
    const record: ConsentRecord = {
      consented: true,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    setHasConsented(true);
    setShowConsentModal(false);
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
    openConsentDialog,
    closeConsentDialog,
  };
}
