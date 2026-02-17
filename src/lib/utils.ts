import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  // Date-only strings (e.g. "2025-01-01") are parsed as UTC midnight.
  // Use timeZone: 'UTC' to avoid off-by-one in negative-offset timezones.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return date.toLocaleDateString('en-US', isDateOnly ? { timeZone: 'UTC' } : undefined);
}
