'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { logger } from '@/lib/logger';

interface Preferences {
  email_case_updates: boolean;
  email_document_uploads: boolean;
  email_deadline_reminders: boolean;
  email_form_updates: boolean;
  email_team_updates: boolean;
  email_billing_updates: boolean;
  email_marketing: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  email_case_updates: true,
  email_document_uploads: true,
  email_deadline_reminders: true,
  email_form_updates: true,
  email_team_updates: true,
  email_billing_updates: true,
  email_marketing: false,
};

const PREFERENCE_ITEMS: { key: keyof Preferences; label: string; description: string }[] = [
  {
    key: 'email_case_updates',
    label: 'Case Updates',
    description: 'Receive notifications when case status changes.',
  },
  {
    key: 'email_document_uploads',
    label: 'Document Uploads',
    description: 'Get notified when clients upload documents.',
  },
  {
    key: 'email_deadline_reminders',
    label: 'Deadline Reminders',
    description: 'Receive reminders for upcoming deadlines.',
  },
  {
    key: 'email_form_updates',
    label: 'Form Updates',
    description: 'Get notified when forms are updated or reviewed.',
  },
  {
    key: 'email_team_updates',
    label: 'Team Updates',
    description: 'Notifications about team member changes.',
  },
  {
    key: 'email_billing_updates',
    label: 'Billing Updates',
    description: 'Subscription and payment notifications.',
  },
  {
    key: 'email_marketing',
    label: 'Marketing Emails',
    description: 'Product updates and announcements.',
  },
];

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetchWithTimeout('/api/notifications/preferences');
        if (response.ok) {
          const { data } = await response.json();
          if (data) {
            setPreferences({
              email_case_updates: data.email_case_updates ?? true,
              email_document_uploads: data.email_document_uploads ?? true,
              email_deadline_reminders: data.email_deadline_reminders ?? true,
              email_form_updates: data.email_form_updates ?? true,
              email_team_updates: data.email_team_updates ?? true,
              email_billing_updates: data.email_billing_updates ?? true,
              email_marketing: data.email_marketing ?? false,
            });
          }
        }
      } catch (error) {
        logger.error('Failed to load notification preferences', { error });
        setError('Failed to load notification preferences');
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, []);

  const handleToggle = async (key: keyof Preferences, value: boolean) => {
    const previousValue = preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await fetchWithTimeout('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update');
      }

      toast.success('Notification preference updated');
    } catch (error) {
      logger.error('Failed to update notification preference', { error });
      setPreferences((prev) => ({ ...prev, [key]: previousValue }));
      toast.error('Failed to update notification preference');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>
          Choose what emails you want to receive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PREFERENCE_ITEMS.map((item, index) => (
          <div key={item.key}>
            {index > 0 && <Separator className="mb-4" />}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 w-14 rounded-full p-0 transition-colors',
                  preferences[item.key]
                    ? 'bg-primary hover:bg-primary/90 border-primary'
                    : 'bg-muted hover:bg-muted/80 border-muted'
                )}
                onClick={() => handleToggle(item.key, !preferences[item.key])}
              >
                <span className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform',
                  preferences[item.key] ? 'translate-x-3' : '-translate-x-3'
                )}>
                  {preferences[item.key] ? (
                    <Check size={12} className="text-primary" />
                  ) : (
                    <X size={12} className="text-muted-foreground" />
                  )}
                </span>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
