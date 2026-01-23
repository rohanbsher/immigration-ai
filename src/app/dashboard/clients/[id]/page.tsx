'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Edit,
  Save,
  Loader2,
  Mail,
  Phone,
  Calendar,
  FolderOpen,
  FileText,
  Plus,
} from 'lucide-react';
import { useClient, useClientCases, useUpdateClient } from '@/hooks/use-clients';
import { CaseStatusBadge } from '@/components/cases';
import { toast } from 'sonner';
import type { CaseStatus, VisaType } from '@/types';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: client, isLoading, error } = useClient(id);
  const { data: cases, isLoading: casesLoading } = useClientCases(id);
  const { mutate: updateClient, isPending: isUpdating } = useUpdateClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    date_of_birth: '',
    country_of_birth: '',
    nationality: '',
  });

  const handleEdit = () => {
    if (client) {
      setEditData({
        first_name: client.first_name,
        last_name: client.last_name,
        phone: client.phone || '',
        date_of_birth: client.date_of_birth || '',
        country_of_birth: client.country_of_birth || '',
        nationality: client.nationality || '',
      });
      setEditDialogOpen(true);
    }
  };

  const handleSave = () => {
    updateClient(
      { id, data: editData },
      {
        onSuccess: () => {
          toast.success('Client updated successfully');
          setEditDialogOpen(false);
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to update client');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">Client not found or you don&apos;t have access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-16 w-16">
          <AvatarImage src={client.avatar_url || undefined} />
          <AvatarFallback className="bg-blue-100 text-blue-700 text-xl font-medium">
            {client.first_name.charAt(0)}
            {client.last_name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">
            {client.first_name} {client.last_name}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Mail size={14} />
              {client.email}
            </span>
            {client.phone && (
              <span className="flex items-center gap-1">
                <Phone size={14} />
                {client.phone}
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={handleEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <FolderOpen className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{client.cases_count}</p>
              <p className="text-sm text-slate-500">Total Cases</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <FileText className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{client.active_cases_count}</p>
              <p className="text-sm text-slate-500">Active Cases</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <Calendar className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Date(client.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <p className="text-sm text-slate-500">Client Since</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Cases ({client.cases_count})</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Cases</h3>
            <Link href="/dashboard/cases">
              <Button className="gap-2">
                <Plus size={16} />
                New Case
              </Button>
            </Link>
          </div>

          {casesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : cases && cases.length > 0 ? (
            <div className="space-y-4">
              {cases.map((caseItem: {
                id: string;
                title: string;
                visa_type: VisaType;
                status: CaseStatus;
                deadline: string | null;
                created_at: string;
              }) => (
                <Link key={caseItem.id} href={`/dashboard/cases/${caseItem.id}`}>
                  <Card className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{caseItem.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{caseItem.visa_type}</Badge>
                          <span className="text-sm text-slate-500">
                            Created {new Date(caseItem.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <CaseStatusBadge status={caseItem.status} />
                        {caseItem.deadline && (
                          <span className="text-sm text-slate-500">
                            Due {new Date(caseItem.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600">No cases for this client yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-500">Full Name</p>
                  <p className="font-medium">
                    {client.first_name} {client.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email Address</p>
                  <p className="font-medium">{client.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Phone Number</p>
                  <p className="font-medium">{client.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Date of Birth</p>
                  <p className="font-medium">
                    {client.date_of_birth
                      ? new Date(client.date_of_birth).toLocaleDateString()
                      : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Country of Birth</p>
                  <p className="font-medium">{client.country_of_birth || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Nationality</p>
                  <p className="font-medium">{client.nationality || 'Not provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={editData.first_name}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, first_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={editData.last_name}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, last_name: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={editData.phone}
                onChange={(e) => setEditData((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={editData.date_of_birth}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, date_of_birth: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country_of_birth">Country of Birth</Label>
              <Input
                id="country_of_birth"
                value={editData.country_of_birth}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, country_of_birth: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                value={editData.nationality}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, nationality: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
