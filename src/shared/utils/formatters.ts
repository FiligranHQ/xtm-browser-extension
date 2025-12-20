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
 * Format a number with thousands separator (e.g., 1,234,567)
 */
export function formatNumber(num: number | undefined | null): string {
  if (num === null || num === undefined) return '';
  return num.toLocaleString();
}

/**
 * Format a number with compact notation (K, M, B suffixes)
 * @param num - The number to format
 * @param options - Formatting options
 * @param options.threshold - Only use compact notation above this value (default: 10000)
 * @param options.decimals - Number of decimal places for compact notation (default: 1)
 * @returns Formatted string (e.g., "1,234" or "12.5K" or "1.2M")
 */
export function formatNumberCompact(
  num: number | undefined | null,
  options: { threshold?: number; decimals?: number } = {}
): string {
  if (num === null || num === undefined) return '';
  
  const { threshold = 10000, decimals = 1 } = options;
  
  // Use regular formatting for numbers below threshold
  if (Math.abs(num) < threshold) {
    return num.toLocaleString();
  }
  
  const suffixes = [
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' },
  ];
  
  for (const { value, suffix } of suffixes) {
    if (Math.abs(num) >= value) {
      const formatted = (num / value).toFixed(decimals);
      // Remove trailing zeros after decimal point
      const cleaned = formatted.replace(/\.?0+$/, '');
      return `${cleaned}${suffix}`;
    }
  }
  
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
  if (confidence === null || confidence === undefined) return '';
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

/**
 * Escape HTML special characters for safe display
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

