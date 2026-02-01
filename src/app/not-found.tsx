'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  FileQuestion,
  Home,
  Search,
  FolderOpen,
  FileText,
  Users,
  Settings,
  ArrowRight,
} from 'lucide-react';

const SUGGESTED_PAGES = [
  {
    title: 'Dashboard',
    description: 'View your case overview and recent activity',
    href: '/dashboard',
    icon: Home,
  },
  {
    title: 'Cases',
    description: 'Manage your immigration cases',
    href: '/dashboard/cases',
    icon: FolderOpen,
  },
  {
    title: 'Documents',
    description: 'Access your document vault',
    href: '/dashboard/documents',
    icon: FileText,
  },
  {
    title: 'Clients',
    description: 'View and manage client profiles',
    href: '/dashboard/clients',
    icon: Users,
  },
  {
    title: 'Settings',
    description: 'Configure your account settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export default function NotFound() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <FileQuestion className="h-10 w-10 text-blue-600" />
            </div>
            <p className="text-7xl font-bold text-slate-200 mb-2">404</p>
            <CardTitle className="text-2xl text-slate-900">
              Page Not Found
            </CardTitle>
            <CardDescription className="text-slate-600">
              The page you are looking for does not exist or has been moved.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search for cases, documents, or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-24"
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                Search
              </Button>
            </form>

            {/* Suggested Pages */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Popular Pages
              </h3>
              <div className="grid gap-2">
                {SUGGESTED_PAGES.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                      <page.icon className="h-5 w-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{page.title}</p>
                      <p className="text-xs text-slate-500 truncate">{page.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center border-t pt-6">
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" className="gap-2 w-full">
                <Home size={16} />
                Back to Home
              </Button>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button className="gap-2 w-full">
                Go to Dashboard
                <ArrowRight size={16} />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-6">
          If you believe this is an error, please{' '}
          <a href="mailto:support@immigrationai.com" className="text-blue-600 hover:underline">
            contact support
          </a>
        </p>
      </div>
    </div>
  );
}
