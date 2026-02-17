'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Files,
  Settings,
  Users,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Building2,
  ListTodo,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { getNavItemsForRole, MAIN_NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/lib/rbac';
import { FirmSwitcher } from '@/components/firm/firm-switcher';
import { NAV_SHORTCUT_HINTS } from '@/hooks/use-keyboard-shortcuts';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navIcons: Record<string, React.ElementType> = {
  Dashboard: LayoutDashboard,
  Cases: FolderOpen,
  Documents: Files,
  Forms: FileText,
  Tasks: ListTodo,
  Analytics: BarChart3,
  Clients: Users,
  Firm: Building2,
  Billing: CreditCard,
  Notifications: Bell,
  Settings: Settings,
  'My Cases': LayoutDashboard,
  'My Documents': FolderOpen,
};

const SECTION_MAP: Record<string, string> = {
  Dashboard: 'Workspace',
  Cases: 'Workspace',
  Documents: 'Workspace',
  Forms: 'Workspace',
  Tasks: 'Workspace',
  Analytics: 'Insights',
  Clients: 'Management',
  Firm: 'Management',
  Billing: 'Management',
  Notifications: 'Account',
  Settings: 'Account',
  'My Cases': 'Workspace',
  'My Documents': 'Workspace',
};

const SECTION_ORDER = ['Workspace', 'Insights', 'Management', 'Account'];

function groupItemsIntoSections(items: NavItem[]): NavSection[] {
  const grouped: Record<string, NavItem[]> = {};

  for (const item of items) {
    const section = SECTION_MAP[item.label] || 'Other';
    if (!grouped[section]) {
      grouped[section] = [];
    }
    grouped[section].push(item);
  }

  return SECTION_ORDER
    .filter((section) => grouped[section]?.length > 0)
    .map((section) => ({
      label: section,
      items: grouped[section],
    }));
}

interface SidebarProps {
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
    role: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });
  const { signOut, isLoading } = useAuth();

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const filteredMainNavItems: NavItem[] = useMemo(() => {
    const roleItems = getNavItemsForRole(user?.role as UserRole | undefined, MAIN_NAV_ITEMS);
    return roleItems.map((item) => ({
      label: item.label,
      href: item.href,
      icon: navIcons[item.label] || LayoutDashboard,
    }));
  }, [user?.role]);

  const filteredBottomNavItems: NavItem[] = useMemo(() => {
    const roleItems = getNavItemsForRole(user?.role as UserRole | undefined, BOTTOM_NAV_ITEMS);
    return roleItems.map((item) => ({
      label: item.label,
      href: item.href,
      icon: navIcons[item.label] || Settings,
    }));
  }, [user?.role]);

  const allNavItems = useMemo(
    () => [...filteredMainNavItems, ...filteredBottomNavItems],
    [filteredMainNavItems, filteredBottomNavItems]
  );

  const sections = useMemo(
    () => groupItemsIntoSections(allNavItems),
    [allNavItems]
  );

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/dashboard/client') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Failed to log out');
    }
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const shortcutHint = NAV_SHORTCUT_HINTS[item.label];

    const link = (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
          active
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
          collapsed && 'justify-center'
        )}
      >
        <Icon size={20} />
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {shortcutHint && (
              <span className="text-[10px] font-mono tracking-wider opacity-40">
                {shortcutHint}
              </span>
            )}
          </>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>
            {link}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <span>{item.label}</span>
            {shortcutHint && (
              <span className="ml-2 text-xs opacity-60">{shortcutHint}</span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{link}</div>;
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'flex flex-col h-screen bg-sidebar text-sidebar-foreground transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <Sparkles className="text-sidebar-primary-foreground" size={15} />
              </div>
              <span className="font-display text-[15px] tracking-tight">Immigration AI</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </Button>
        </div>

        {/* Firm Switcher */}
        <div className="px-2 pt-2">
          <FirmSwitcher collapsed={collapsed} />
        </div>

        {/* Sectioned Navigation */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          {sections.map((section, sectionIndex) => (
            <div key={section.label}>
              {sectionIndex > 0 && <Separator className="my-2 bg-sidebar-border" />}
              <div className="px-3 py-2">
                {!collapsed && (
                  <span className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
                    {section.label}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {section.items.map(renderNavLink)}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.avatarUrl} />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate capitalize">
                  {user?.role || 'Attorney'}
                </p>
              </div>
            )}
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                disabled={isLoading}
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut size={18} />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
