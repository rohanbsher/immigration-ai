'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  Search,
  Loader2,
  Mail,
  Phone,
  FolderOpen,
  Calendar,
  Plus,
} from 'lucide-react';
import { useClients } from '@/hooks/use-clients';

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const { data: clients, isLoading, error } = useClients();

  const filteredClients = clients?.filter((client) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      client.first_name.toLowerCase().includes(searchLower) ||
      client.last_name.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-600">Manage your client relationships</p>
        </div>
        <Link href="/dashboard/cases">
          <Button className="gap-2">
            <Plus size={18} />
            New Case (Add Client)
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search clients by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{clients?.length || 0}</p>
              <p className="text-sm text-slate-500">Total Clients</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <FolderOpen className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {clients?.reduce((sum, c) => sum + c.active_cases_count, 0) || 0}
              </p>
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
                {clients?.reduce((sum, c) => sum + c.cases_count, 0) || 0}
              </p>
              <p className="text-sm text-slate-500">Total Cases</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clients List */}
      {error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">Failed to load clients. Please try again.</p>
          </CardContent>
        </Card>
      ) : filteredClients && filteredClients.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Link key={client.id} href={`/dashboard/clients/${client.id}`}>
              <Card className="h-full hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
                        {client.first_name.charAt(0)}
                        {client.last_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {client.first_name} {client.last_name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                        <Mail size={12} />
                        <span className="truncate">{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Phone size={12} />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      {client.cases_count} cases
                    </Badge>
                    {client.active_cases_count > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {client.active_cases_count} active
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : clients && clients.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No clients yet</h3>
            <p className="text-slate-600 mb-4">
              Create a case to add your first client.
            </p>
            <Link href="/dashboard/cases">
              <Button className="gap-2">
                <Plus size={18} />
                Create Case
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">No clients match your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
