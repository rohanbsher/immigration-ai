'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ClientSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ClientStepProps {
  clientSearch: string;
  onSearchChange: (value: string) => void;
  isSearching: boolean;
  searchResults: ClientSearchResult[] | undefined;
  selectedClientId: string;
  onClientSelect: (clientId: string, clientName: string) => void;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  onFieldChange: (field: string, value: string) => void;
}

export function ClientStep({
  clientSearch,
  onSearchChange,
  isSearching,
  searchResults,
  selectedClientId,
  onClientSelect,
  clientFirstName,
  clientLastName,
  clientEmail,
  onFieldChange,
}: ClientStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Select or Add Client</h2>
        <p className="text-slate-600">
          Choose an existing client or add a new one for this case.
        </p>
      </div>

      {/* Search Existing Clients */}
      <div className="space-y-4">
        <Label>Search Existing Clients</Label>
        <Input
          placeholder="Search by name or email..."
          value={clientSearch}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {isSearching && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        )}
        {searchResults && searchResults.length > 0 && (
          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            {searchResults.map((client) => (
              <div
                key={client.id}
                className={`p-3 cursor-pointer hover:bg-slate-50 ${
                  selectedClientId === client.id ? 'bg-blue-50' : ''
                }`}
                onClick={() =>
                  onClientSelect(
                    client.id,
                    `${client.first_name} ${client.last_name}`
                  )
                }
              >
                <p className="font-medium">
                  {client.first_name} {client.last_name}
                </p>
                <p className="text-sm text-slate-500">{client.email}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-500">Or add new client</span>
        </div>
      </div>

      {/* New Client Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              value={clientFirstName}
              onChange={(e) => onFieldChange('client_first_name', e.target.value)}
              disabled={!!selectedClientId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              value={clientLastName}
              onChange={(e) => onFieldChange('client_last_name', e.target.value)}
              disabled={!!selectedClientId}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={clientEmail}
            onChange={(e) => onFieldChange('client_email', e.target.value)}
            disabled={!!selectedClientId}
          />
        </div>
      </div>
    </div>
  );
}
