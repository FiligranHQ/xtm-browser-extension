/**
 * Common formatting utilities
 */

/**
 * Format a date for display
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(date);
  }
}

/**
 * Format a date with time for display
 */
export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  } catch {
    return String(date);
  }
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date | undefined | null): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    
    return formatDate(d);
  } catch {
    return String(date);
  }
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format a number with thousands separator
 */
export function formatNumber(num: number | undefined | null): string {
  if (num == null) return '';
  return num.toLocaleString();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format entity type for display (convert kebab-case to title case)
 */
export function formatEntityType(type: string): string {
  if (!type) return '';
  return type
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Convert camelCase or PascalCase to spaced words
 */
export function camelToSpaced(str: string): string {
  return str.replace(/([A-Z])/g, ' $1').trim();
}

/**
 * Format confidence score for display
 */
export function formatConfidence(confidence: number | undefined | null): string {
  if (confidence == null) return '';
  return `${confidence}%`;
}

/**
 * Format CVSS score with severity
 */
export function formatCvssScore(score: number): { label: string; severity: 'none' | 'low' | 'medium' | 'high' | 'critical' } {
  if (score === 0) return { label: '0.0', severity: 'none' };
  if (score < 4) return { label: score.toFixed(1), severity: 'low' };
  if (score < 7) return { label: score.toFixed(1), severity: 'medium' };
  if (score < 9) return { label: score.toFixed(1), severity: 'high' };
  return { label: score.toFixed(1), severity: 'critical' };
}

