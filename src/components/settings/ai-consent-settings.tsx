'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAiConsent } from '@/hooks/use-ai-consent';
import { toast } from 'sonner';

export function AiConsentSettings() {
  const {
    hasConsented,
    consentError,
    grantConsent,
    revokeConsent,
  } = useAiConsent();

  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

  const handleGrant = async () => {
    setIsGranting(true);
    try {
      await grantConsent();
      toast.success('AI features enabled');
    } catch {
      toast.error('Failed to enable AI features');
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      await revokeConsent();
      setShowRevokeDialog(false);
      toast.success('AI features disabled');
    } catch {
      toast.error('Failed to disable AI features');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Sparkles size={20} />
                AI-Powered Features
              </CardTitle>
              <CardDescription>
                Allow AI to analyze your documents, auto-fill forms, and provide case recommendations.
              </CardDescription>
            </div>
            {hasConsented ? (
              <Badge variant="secondary" className="bg-success/10 text-success">
                <CheckCircle2 size={12} className="mr-1" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                <XCircle size={12} className="mr-1" />
                Disabled
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>When enabled, AI features include:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Document analysis and data extraction</li>
              <li>Automated form filling suggestions</li>
              <li>Case success score predictions</li>
              <li>AI chat assistant for case questions</li>
            </ul>
          </div>

          {consentError && (
            <p className="text-sm text-destructive">{consentError}</p>
          )}

          {hasConsented ? (
            <Button
              variant="outline"
              onClick={() => setShowRevokeDialog(true)}
            >
              Disable AI Features
            </Button>
          ) : (
            <Button onClick={handleGrant} disabled={isGranting}>
              {isGranting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Enable AI Features
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable AI Features</DialogTitle>
            <DialogDescription>
              Disabling AI features will prevent document analysis, automated form filling,
              and AI-powered recommendations. You can re-enable them at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable AI Features'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
