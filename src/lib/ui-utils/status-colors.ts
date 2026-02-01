/**
 * UI color/style utilities for status indicators.
 * Consolidated from various hooks to avoid duplication.
 */

/**
 * Get colors for document completeness percentage.
 */
export function getCompletenessColor(percentage: number): {
  bg: string;
  text: string;
  border: string;
  gradient: string;
} {
  if (percentage >= 90) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-500',
      gradient: 'from-green-500 to-emerald-500',
    };
  }
  if (percentage >= 70) {
    return {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-500',
      gradient: 'from-blue-500 to-cyan-500',
    };
  }
  if (percentage >= 50) {
    return {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      border: 'border-yellow-500',
      gradient: 'from-yellow-500 to-orange-500',
    };
  }
  return {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-500',
    gradient: 'from-red-500 to-rose-500',
  };
}

/**
 * Get colors for success score.
 */
export function getSuccessScoreColors(score: number): {
  bg: string;
  text: string;
  border: string;
  gradient: string;
} {
  if (score >= 80) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-500',
      gradient: 'from-green-500 to-emerald-500',
    };
  }
  if (score >= 60) {
    return {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-500',
      gradient: 'from-blue-500 to-cyan-500',
    };
  }
  if (score >= 40) {
    return {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      border: 'border-yellow-500',
      gradient: 'from-yellow-500 to-orange-500',
    };
  }
  return {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-500',
    gradient: 'from-red-500 to-rose-500',
  };
}

/**
 * Get colors for recommendation priority.
 */
export function getPriorityColors(priority: 'critical' | 'high' | 'medium' | 'low'): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  switch (priority) {
    case 'critical':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-500',
        icon: 'text-red-600',
      };
    case 'high':
      return {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-500',
        icon: 'text-orange-600',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-500',
        icon: 'text-yellow-600',
      };
    case 'low':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-500',
        icon: 'text-blue-600',
      };
  }
}

/**
 * Get colors for deadline severity.
 */
export function getSeverityColors(severity: 'critical' | 'warning' | 'info'): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-500',
        icon: 'text-red-600',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-500',
        icon: 'text-yellow-600',
      };
    case 'info':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-500',
        icon: 'text-blue-600',
      };
  }
}

/**
 * Get factor status icon info.
 */
export function getFactorStatusInfo(status: 'good' | 'warning' | 'poor'): {
  icon: 'check' | 'alert' | 'x';
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'good':
      return { icon: 'check', color: 'text-green-600', bgColor: 'bg-green-100' };
    case 'warning':
      return { icon: 'alert', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    case 'poor':
      return { icon: 'x', color: 'text-red-600', bgColor: 'bg-red-100' };
  }
}
