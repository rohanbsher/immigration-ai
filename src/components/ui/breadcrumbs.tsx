'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
}

export function Breadcrumbs({ items, showHome = true }: BreadcrumbsProps) {
  const allItems = showHome
    ? [{ label: 'Dashboard', href: '/dashboard' }, ...items]
    : items;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {showHome && (
        <Link
          href="/dashboard"
          className="text-slate-500 hover:text-slate-700 transition-colors"
          aria-label="Home"
        >
          <Home className="h-4 w-4" />
        </Link>
      )}

      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        const isFirst = index === 0;

        // Skip the home item since we rendered it as an icon
        if (showHome && isFirst) {
          return (
            <ChevronRight
              key={`sep-${index}`}
              className="h-4 w-4 text-slate-400 flex-shrink-0"
              aria-hidden="true"
            />
          );
        }

        return (
          <Fragment key={item.label}>
            {!isFirst && (
              <ChevronRight
                className="h-4 w-4 text-slate-400 flex-shrink-0"
                aria-hidden="true"
              />
            )}
            {isLast || !item.href ? (
              <span
                className="text-slate-900 font-medium truncate max-w-[200px]"
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-slate-500 hover:text-slate-700 transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

// Helper function to generate common breadcrumb paths
export function generateCaseBreadcrumbs(
  caseId: string,
  caseTitle: string,
  additionalItems?: BreadcrumbItem[]
): BreadcrumbItem[] {
  const baseCrumbs: BreadcrumbItem[] = [
    { label: 'Cases', href: '/dashboard/cases' },
    { label: caseTitle, href: `/dashboard/cases/${caseId}` },
  ];

  if (additionalItems) {
    return [...baseCrumbs, ...additionalItems];
  }

  return baseCrumbs;
}

export function generateFormBreadcrumbs(
  caseId: string,
  caseTitle: string,
  formType: string
): BreadcrumbItem[] {
  return [
    { label: 'Cases', href: '/dashboard/cases' },
    { label: caseTitle, href: `/dashboard/cases/${caseId}` },
    { label: `Form ${formType}` },
  ];
}

export function generateClientBreadcrumbs(
  clientId: string,
  clientName: string,
  additionalItems?: BreadcrumbItem[]
): BreadcrumbItem[] {
  const baseCrumbs: BreadcrumbItem[] = [
    { label: 'Clients', href: '/dashboard/clients' },
    { label: clientName, href: `/dashboard/clients/${clientId}` },
  ];

  if (additionalItems) {
    return [...baseCrumbs, ...additionalItems];
  }

  return baseCrumbs;
}
