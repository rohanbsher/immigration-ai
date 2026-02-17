'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  FolderOpen,
  Files,
  FileText,
  ListTodo,
  BarChart3,
  Users,
  Building2,
  CreditCard,
  Bell,
  Settings,
  Plus,
  Upload,
  Search,
} from 'lucide-react';

const navigationPages = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Cases', href: '/dashboard/cases', icon: FolderOpen },
  { name: 'Documents', href: '/dashboard/documents', icon: Files },
  { name: 'Forms', href: '/dashboard/forms', icon: FileText },
  { name: 'Tasks', href: '/dashboard/tasks', icon: ListTodo },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Clients', href: '/dashboard/clients', icon: Users },
  { name: 'Firm', href: '/dashboard/firm', icon: Building2 },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const quickActions = [
  { name: 'New Case', href: '/dashboard/cases/new', icon: Plus },
  { name: 'Upload Document', href: '/dashboard/documents?action=upload', icon: Upload },
  { name: 'Search Cases', href: '/dashboard/cases', icon: Search },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search pages and actions"
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navigationPages.map((page) => {
            const Icon = page.icon;
            return (
              <CommandItem
                key={page.href}
                value={page.name}
                onSelect={() => handleSelect(page.href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{page.name}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={action.href}
                value={action.name}
                onSelect={() => handleSelect(action.href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{action.name}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  return { open, setOpen, toggle };
}
