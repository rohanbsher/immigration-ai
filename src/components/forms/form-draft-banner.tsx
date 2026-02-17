'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface FormDraftBannerProps {
  hasDraft: boolean;
  draftAge: string | null;
  onRestore: () => void;
  onDiscard: () => void;
}

export function FormDraftBanner({
  hasDraft,
  draftAge,
  onRestore,
  onDiscard,
}: FormDraftBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!hasDraft || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
      <p>
        Draft saved {draftAge}.{' '}
        <span className="text-blue-600 dark:text-blue-300">
          Would you like to restore it?
        </span>
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onDiscard();
            setDismissed(true);
          }}
        >
          Discard
        </Button>
        <Button
          size="sm"
          onClick={() => {
            onRestore();
            setDismissed(true);
          }}
        >
          Restore
        </Button>
      </div>
    </div>
  );
}
