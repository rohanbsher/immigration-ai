'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ShortcutDefinition {
  keys: string[];
  label: string;
  description: string;
  action: () => void;
  category: string;
}

const SEQUENCE_TIMEOUT_MS = 800;

function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((active as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  const toggleDialog = useCallback(() => {
    setDialogOpen((prev) => !prev);
  }, []);

  const shortcuts: ShortcutDefinition[] = useMemo(() => [
    {
      keys: ['g', 'd'],
      label: 'G D',
      description: 'Go to Dashboard',
      action: () => navigate('/dashboard'),
      category: 'Navigation',
    },
    {
      keys: ['g', 'c'],
      label: 'G C',
      description: 'Go to Cases',
      action: () => navigate('/dashboard/cases'),
      category: 'Navigation',
    },
    {
      keys: ['g', 't'],
      label: 'G T',
      description: 'Go to Tasks',
      action: () => navigate('/dashboard/tasks'),
      category: 'Navigation',
    },
    {
      keys: ['g', 's'],
      label: 'G S',
      description: 'Go to Settings',
      action: () => navigate('/dashboard/settings'),
      category: 'Navigation',
    },
    {
      keys: ['g', 'l'],
      label: 'G L',
      description: 'Go to Clients',
      action: () => navigate('/dashboard/clients'),
      category: 'Navigation',
    },
    {
      keys: ['g', 'o'],
      label: 'G O',
      description: 'Go to Documents',
      action: () => navigate('/dashboard/documents'),
      category: 'Navigation',
    },
    {
      keys: ['n', 'c'],
      label: 'N C',
      description: 'New Case',
      action: () => navigate('/dashboard/cases/new'),
      category: 'Actions',
    },
    {
      keys: ['?'],
      label: '?',
      description: 'Show keyboard shortcuts',
      action: toggleDialog,
      category: 'Help',
    },
  ], [navigate, toggleDialog]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in form fields
      if (isInputFocused()) return;

      // Don't intercept when modifier keys are held (except shift for ?)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Handle single-key shortcut: ?
      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        toggleDialog();
        return;
      }

      // Handle two-key sequences
      if (pendingKeyRef.current) {
        const firstKey = pendingKeyRef.current;
        pendingKeyRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        const matched = shortcuts.find(
          (s) => s.keys.length === 2 && s.keys[0] === firstKey && s.keys[1] === key
        );

        if (matched) {
          e.preventDefault();
          matched.action();
        }
        return;
      }

      // Start a sequence if this key is the first key of any two-key shortcut
      const isSequenceStart = shortcuts.some(
        (s) => s.keys.length === 2 && s.keys[0] === key
      );

      if (isSequenceStart) {
        pendingKeyRef.current = key;
        timeoutRef.current = setTimeout(() => {
          pendingKeyRef.current = null;
          timeoutRef.current = null;
        }, SEQUENCE_TIMEOUT_MS);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toggleDialog, navigate, shortcuts]);

  return {
    shortcuts,
    dialogOpen,
    setDialogOpen,
  };
}

// Shortcut hint label mapping for sidebar nav items
export const NAV_SHORTCUT_HINTS: Record<string, string> = {
  Dashboard: 'G D',
  Cases: 'G C',
  Tasks: 'G T',
  Settings: 'G S',
  Clients: 'G L',
  Documents: 'G O',
};
