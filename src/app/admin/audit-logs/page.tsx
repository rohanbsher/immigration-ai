'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Database, Shield } from 'lucide-react';

const TRACKED_TABLES = ['cases', 'documents', 'forms', 'profiles', 'clients', 'notifications'];
const TRACKED_OPERATIONS = ['INSERT', 'UPDATE', 'DELETE', 'SELECT', 'LOGIN', 'LOGOUT'];

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          System audit logging status and configuration
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Logging Status
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge className="bg-success/10 text-success hover:bg-success/10">Configured</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Audit triggers are configured for the tables below
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tracked Tables
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{TRACKED_TABLES.length}</div>
            <p className="text-xs text-muted-foreground">Tables with audit triggers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tracked Operations
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{TRACKED_OPERATIONS.length}</div>
            <p className="text-xs text-muted-foreground">Operation types being logged</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracked Tables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3">
            {TRACKED_TABLES.map((table) => (
              <div key={table} className="flex items-center gap-2 p-2 rounded border">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono">{table}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracked Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TRACKED_OPERATIONS.map((op) => (
              <Badge key={op} variant="secondary">{op}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw Access</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            For detailed audit log viewing with search and filtering, access the Supabase dashboard
            directly. Full audit log viewer with advanced search is planned for a future release.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
