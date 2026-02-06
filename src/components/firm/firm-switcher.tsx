'use client';

import { Building2, ChevronsUpDown, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useFirms } from '@/hooks/use-firm';
import Link from 'next/link';
import type { Firm } from '@/types/firms';

interface FirmSwitcherProps {
  collapsed?: boolean;
  selectedFirmId?: string;
  onFirmChange?: (firm: Firm) => void;
}

export function FirmSwitcher({ collapsed, selectedFirmId, onFirmChange }: FirmSwitcherProps) {
  const { data: firms, isLoading } = useFirms();

  if (isLoading || !firms || firms.length === 0) return null;

  const selectedFirm = firms.find((f) => f.id === selectedFirmId) || firms[0];

  if (firms.length <= 1 && collapsed) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent',
            collapsed && 'justify-center px-2'
          )}
        >
          <Building2 size={18} className="flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left text-sm font-medium">
                {selectedFirm.name}
              </span>
              {firms.length > 1 && <ChevronsUpDown size={14} className="text-sidebar-foreground/40" />}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Firm</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {firms.map((firm) => (
          <DropdownMenuItem
            key={firm.id}
            onClick={() => onFirmChange?.(firm)}
            className="flex items-center gap-2"
          >
            <Building2 size={14} />
            <span className="flex-1 truncate">{firm.name}</span>
            {firm.id === selectedFirm.id && (
              <Check size={14} className="text-green-600" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/firm" className="flex items-center gap-2">
            <Plus size={14} />
            <span>Create New Firm</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
