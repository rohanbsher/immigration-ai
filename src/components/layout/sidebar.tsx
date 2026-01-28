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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { getNavItemsForRole, MAIN_NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/lib/rbac';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

// Map of nav item labels to their icons
const navIcons: Record<string, React.ElementType> = {
  Dashboard: LayoutDashboard,
  Cases: FolderOpen,
  Documents: Files,
  Forms: FileText,
  Tasks: ListTodo,
  Clients: Users,
  Firm: Building2,
  Billing: CreditCard,
  Notifications: Bell,
  Settings: Settings,
};

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
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, isLoading } = useAuth();

  // Filter nav items based on user role
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

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center font-bold text-sidebar-primary-foreground">
              IA
            </div>
            <span className="font-semibold">Immigration AI</span>
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

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {filteredMainNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="py-4 px-2 border-t border-sidebar-border space-y-1">
        {filteredBottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

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
  );
}
