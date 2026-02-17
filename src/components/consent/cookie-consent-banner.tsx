'use client';

import { useConsent } from '@/hooks/use-consent';
import { Button } from '@/components/ui/button';

export function CookieConsentBanner() {
  const { analyticsConsented, consentLoaded, acceptAll, rejectAll } = useConsent();

  // Don't render until we've checked localStorage (prevents flash on load)
  if (!consentLoaded) return null;

  // User already made a choice — stay dismissed
  if (analyticsConsented !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      data-consent-banner
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies for analytics and session replay to improve your
          experience. You can accept or reject non-essential cookies.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={rejectAll}>
            Reject All
          </Button>
          <Button size="sm" onClick={acceptAll}>
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
