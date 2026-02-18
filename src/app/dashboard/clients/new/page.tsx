'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useCreateClient } from '@/hooks/use-clients';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { toast } from 'sonner';

export default function NewClientPage() {
  const router = useRouter();
  const { mutate: createClient, isPending } = useCreateClient();
  const { isLoading: isAuthLoading, hasAccess } = useRoleGuard({
    requiredRoles: ['attorney', 'admin'],
  });

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    date_of_birth: '',
    country_of_birth: '',
    nationality: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.first_name || !formData.last_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Strip empty optional fields
    const payload = {
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      ...(formData.phone && { phone: formData.phone }),
      ...(formData.date_of_birth && { date_of_birth: formData.date_of_birth }),
      ...(formData.country_of_birth && { country_of_birth: formData.country_of_birth }),
      ...(formData.nationality && { nationality: formData.nationality }),
    };

    createClient(payload, {
      onSuccess: (client) => {
        toast.success('Client created successfully');
        router.push(`/dashboard/clients/${client.id}`);
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create client');
      },
    });
  };

  if (isAuthLoading || !hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl tracking-tight text-foreground">Add Client</h1>
          <p className="text-muted-foreground">Add a new client to your practice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Required Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>Required fields are marked with *</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="john.doe@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </CardContent>
        </Card>

        {/* Optional Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
            <CardDescription>Optional immigration-related information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData((prev) => ({ ...prev, date_of_birth: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country_of_birth">Country of Birth</Label>
              <Input
                id="country_of_birth"
                value={formData.country_of_birth}
                onChange={(e) => setFormData((prev) => ({ ...prev, country_of_birth: e.target.value }))}
                placeholder="India"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                value={formData.nationality}
                onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                placeholder="Indian"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Create Client
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
