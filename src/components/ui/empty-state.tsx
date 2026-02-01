'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, ArrowRight, LucideIcon } from 'lucide-react';
import { ComponentType, SVGProps } from 'react';

/** Icon type that accepts both Lucide icons and custom SVG components */
type IconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

interface EmptyStateProps {
  icon: IconComponent;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  onSecondaryAction?: () => void;
  className?: string;
  variant?: 'default' | 'card' | 'inline';
  showIllustration?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
  className,
  variant = 'default',
  showIllustration = true,
}: EmptyStateProps) {
  const containerClasses = cn(
    'text-center',
    variant === 'default' && 'py-12 px-6',
    variant === 'card' && 'p-8 bg-card rounded-xl border border-border/50',
    variant === 'inline' && 'py-6',
    className
  );

  const ActionButton = actionHref ? (
    <Link href={actionHref}>
      <Button className="gap-2">
        <Plus size={16} />
        {actionLabel}
      </Button>
    </Link>
  ) : onAction ? (
    <Button onClick={onAction} className="gap-2">
      <Plus size={16} />
      {actionLabel}
    </Button>
  ) : null;

  const SecondaryButton = secondaryActionHref ? (
    <Link href={secondaryActionHref}>
      <Button variant="outline" className="gap-2">
        {secondaryActionLabel}
        <ArrowRight size={16} />
      </Button>
    </Link>
  ) : onSecondaryAction ? (
    <Button variant="outline" onClick={onSecondaryAction} className="gap-2">
      {secondaryActionLabel}
      <ArrowRight size={16} />
    </Button>
  ) : null;

  return (
    <div className={containerClasses}>
      {showIllustration && (
        <div className="relative mx-auto mb-6 w-32 h-32">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full animate-pulse" />
          <div className="absolute inset-2 bg-gradient-to-br from-primary/5 to-transparent rounded-full" />

          {/* Icon container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
              <Icon className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Decorative dots */}
          <div className="absolute top-2 right-4 w-2 h-2 rounded-full bg-primary/30" />
          <div className="absolute bottom-6 left-2 w-3 h-3 rounded-full bg-primary/20" />
          <div className="absolute top-8 left-6 w-1.5 h-1.5 rounded-full bg-primary/40" />
        </div>
      )}

      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        {description}
      </p>

      {(ActionButton || SecondaryButton) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {ActionButton}
          {SecondaryButton}
        </div>
      )}
    </div>
  );
}

// Preset empty states for common use cases
export function CasesEmptyState({ onCreateCase }: { onCreateCase?: () => void }) {
  return (
    <EmptyState
      icon={FolderIcon}
      title="No cases yet"
      description="Get started by creating your first immigration case. Track documents, deadlines, and forms all in one place."
      actionLabel="Create Your First Case"
      onAction={onCreateCase}
      secondaryActionLabel="Learn More"
      secondaryActionHref="/help/cases"
    />
  );
}

export function DocumentsEmptyState() {
  return (
    <EmptyState
      icon={FileTextIcon}
      title="No documents uploaded"
      description="Upload client documents like passports, visas, and supporting evidence. Our AI will automatically extract key information."
      actionLabel="Upload Documents"
      actionHref="/dashboard/documents/upload"
      secondaryActionLabel="View Cases"
      secondaryActionHref="/dashboard/cases"
    />
  );
}

export function FormsEmptyState({ onCreateForm }: { onCreateForm?: () => void }) {
  return (
    <EmptyState
      icon={ClipboardIcon}
      title="No forms created"
      description="Create USCIS forms for your cases. Our AI can automatically fill in information from uploaded documents."
      actionLabel="Create Form"
      onAction={onCreateForm}
      secondaryActionLabel="View Form Templates"
      secondaryActionHref="/dashboard/forms/templates"
    />
  );
}

export function ClientsEmptyState() {
  return (
    <EmptyState
      icon={UsersIcon}
      title="No clients added"
      description="Add your clients to manage their immigration cases, documents, and communication in one place."
      actionLabel="Add Client"
      actionHref="/dashboard/clients/new"
    />
  );
}

export function NotificationsEmptyState() {
  return (
    <EmptyState
      icon={BellIcon}
      title="No notifications"
      description="You're all caught up! Notifications about case updates, deadlines, and messages will appear here."
      showIllustration={true}
      variant="inline"
    />
  );
}

export function SearchEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={SearchIcon}
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try adjusting your search terms or browse all items.`}
      showIllustration={true}
      variant="inline"
    />
  );
}

// Simple icon components for the presets
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
      />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}
