/**
 * Injector Helper Functions
 * 
 * Utilities for formatting and displaying injector/contract information.
 */

/**
 * Format injector name for display
 * Converts snake_case to Title Case with special handling for known names
 * 
 * Examples:
 * - "openaev_implant" -> "OpenAEV Implant"
 * - "caldera_ability" -> "Caldera Ability"
 * - "atomic_red_team" -> "Atomic Red Team"
 */
export function formatInjectorName(name: string): string {
  if (!name) return '';
  return name
    .replace(/_/g, ' ')
    .replace(/openaev/gi, 'OpenAEV')
    .replace(/caldera/gi, 'Caldera')
    .replace(/atomic/gi, 'Atomic')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get contract label from contract object
 */
export function getContractLabel(contract: {
  injector_contract_labels?: { en?: string };
  injector_name?: string;
}): string {
  return contract.injector_contract_labels?.en || contract.injector_name || 'Unknown';
}

/**
 * Get platforms from contract object
 */
export function getContractPlatforms(contract: {
  injector_contract_platforms?: string[];
}): string[] {
  return contract.injector_contract_platforms || [];
}

