'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { AutofillGap } from '@/lib/ai';

interface DocumentPromptProps {
  gaps: AutofillGap[];
  caseId: string;
}

export function DocumentPrompt({ gaps, caseId }: DocumentPromptProps) {
  if (gaps.length === 0) return null;

  const totalFields = gaps.reduce((sum, g) => sum + g.fieldCount, 0);

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          {totalFields} field{totalFields !== 1 ? 's' : ''} could not be auto-filled
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Upload these documents to improve coverage:
        </p>
        {gaps.map((gap) => (
          <div
            key={gap.missingDocType}
            className="flex items-start gap-3 p-3 rounded-lg bg-white border"
          >
            <FileUp className="h-[18px] w-[18px] text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{gap.description}</p>
              <p className="text-xs text-muted-foreground">
                Would auto-fill {gap.fieldCount} additional field{gap.fieldCount !== 1 ? 's' : ''}
              </p>
            </div>
            {gap.priority === 'high' && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                High impact
              </span>
            )}
          </div>
        ))}
        <Link href={`/dashboard/cases/${caseId}?tab=documents`}>
          <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
            <FileUp className="h-4 w-4" />
            Upload Documents
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
