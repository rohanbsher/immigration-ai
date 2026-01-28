'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateFirm } from '@/hooks/use-firm';
import type { Firm, UpdateFirmInput } from '@/types/firms';

interface FirmSettingsProps {
  firm: Firm;
}

export function FirmSettings({ firm }: FirmSettingsProps) {
  const updateFirm = useUpdateFirm();

  // Use firm data as initial value, but allow user to edit
  const initialFormData = useMemo(() => ({
    name: firm.name,
    website: firm.website || '',
    phone: firm.phone || '',
  }), [firm.name, firm.website, firm.phone]);

  const [formData, setFormData] = useState<UpdateFirmInput>(initialFormData);

  const handleSave = () => {
    if (!formData.name?.trim()) {
      toast.error('Firm name is required');
      return;
    }

    updateFirm.mutate(
      { firmId: firm.id, input: formData },
      {
        onSuccess: () => {
          toast.success('Firm settings updated successfully');
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to update firm settings');
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Firm Information
        </CardTitle>
        <CardDescription>Update your firm&apos;s details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="firm-name">Firm Name</Label>
          <Input
            id="firm-name"
            value={formData.name || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Smith & Associates Law Firm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="firm-website">Website</Label>
          <Input
            id="firm-website"
            type="url"
            value={formData.website || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
            placeholder="https://smithlaw.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="firm-phone">Phone</Label>
          <Input
            id="firm-phone"
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="(555) 123-4567"
          />
        </div>

        <div className="pt-4">
          <Button onClick={handleSave} disabled={updateFirm.isPending}>
            {updateFirm.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
