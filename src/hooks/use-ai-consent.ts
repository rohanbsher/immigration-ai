'use client';

import { useState, useCallback } from 'react';
import { parseApiVoidResponse } from '@/lib/api/parse-response';

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

  const [consentError, setConsentError] = useState<string | null>(null);

  const grantConsent = useCallback(async () => {
    setConsentError(null);
    try {
      const res = await fetch('/api/profile/ai-consent', { method: 'POST' });
      await parseApiVoidResponse(res);
    } catch {
      // Server persistence failed — don't mark consent as granted locally
      // since the server will reject AI requests without the consent record
      setConsentError('Failed to save consent. Please try again.');
      return;
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
    const res = await fetch('/api/profile/ai-consent', { method: 'DELETE' });
    await parseApiVoidResponse(res);
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
    consentError,
    grantConsent,
    revokeConsent,
    openConsentDialog,
    closeConsentDialog,
  };
}
