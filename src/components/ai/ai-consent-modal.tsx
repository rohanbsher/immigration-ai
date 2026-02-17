'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';

interface AIConsentModalProps {
  open: boolean;
  onConsent: () => void;
  onCancel: () => void;
}

export function AIConsentModal({ open, onConsent, onCancel }: AIConsentModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ai-accent" />
            <DialogTitle>AI Data Processing Consent</DialogTitle>
          </div>
          <DialogDescription>
            Please review how your data will be processed before using AI features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm text-foreground">
          <p>
            To provide document analysis and form assistance, your data will be sent to
            third-party AI services:
          </p>

          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>OpenAI</strong> -- for document image analysis and OCR extraction
            </li>
            <li>
              <strong>Anthropic (Claude)</strong> -- for form assistance, case chat, and
              data consistency checks
            </li>
          </ul>

          <div>
            <p className="font-medium text-foreground mb-1">Data that may be shared:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Uploaded document images (passports, visas, supporting documents)</li>
              <li>Case details (visa type, status, timeline information)</li>
              <li>Form field names and values during autofill</li>
              <li>Chat messages you send to the AI assistant</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            By proceeding, you acknowledge that data will be transmitted to these providers
            for processing. For more details, see our{' '}
            <a href="/privacy" className="text-ai-accent hover:underline">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="/ai-disclaimer" className="text-ai-accent hover:underline">
              AI Disclaimer
            </a>
            .
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConsent}>
            I Understand &amp; Agree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
