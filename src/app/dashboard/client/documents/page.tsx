'use client';

import { FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ClientDocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight text-foreground">My Documents</h1>
        <p className="text-muted-foreground">
          View and manage your immigration documents
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-white">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/10 rounded-full scale-150 opacity-50" />
          <FileText className="relative h-16 w-16 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No documents yet
        </h3>
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          Documents shared by your attorney will appear here. You can also
          upload documents for your cases.
        </p>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>
    </div>
  );
}
