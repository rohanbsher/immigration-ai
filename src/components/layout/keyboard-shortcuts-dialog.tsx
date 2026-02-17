'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ShortcutEntry {
  keys: string[];
  label: string;
  description: string;
  category: string;
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: ShortcutEntry[];
}

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: ShortcutEntry }) {
  const keyParts = shortcut.label.split(' ');

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {keyParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-xs text-muted-foreground">then</span>
            )}
            <ShortcutKey>{part}</ShortcutKey>
          </span>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardShortcutsDialogProps) {
  // Group shortcuts by category
  const grouped = shortcuts.reduce<Record<string, ShortcutEntry[]>>(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {}
  );

  // Add the built-in Cmd+K shortcut to display
  const builtInShortcuts: ShortcutEntry[] = [
    {
      keys: ['cmd', 'k'],
      label: 'Cmd K',
      description: 'Open command palette',
      category: 'General',
    },
  ];

  const allGrouped = { General: builtInShortcuts, ...grouped };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster. Press <ShortcutKey>?</ShortcutKey> to toggle this dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-5 max-h-[60vh] overflow-y-auto">
          {Object.entries(allGrouped).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {category}
              </h4>
              <div className="divide-y divide-border">
                {items.map((shortcut) => (
                  <ShortcutRow key={shortcut.label} shortcut={shortcut} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
