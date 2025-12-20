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
 * Escape HTML special characters for safe display
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

