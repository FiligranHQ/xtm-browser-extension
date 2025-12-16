/**
 * Atomic Testing Types (OpenAEV)
 * 
 * Types for atomic testing and payload creation.
 */

/**
 * Injector contract from OpenAEV
 */
export interface InjectorContract {
  injector_contract_id: string;
  injector_contract_labels?: Record<string, string>;
  injector_contract_injector_type?: string;
  injector_contract_injector?: {
    injector_id: string;
    injector_name: string;
    injector_type: string;
  };
  injector_contract_payload_type?: string;
  injector_contract_platforms?: string[];
  // NOTE: This is a List<String> of attack pattern UUIDs from OpenAEV API, not objects!
  injector_contract_attack_patterns?: string[];
  injector_contract_content?: unknown;
}

/**
 * Atomic testing input for creating tests
 */
export interface AtomicTestingInput {
  inject_title: string;
  inject_description?: string;
  inject_injector_contract: string;
  inject_content?: Record<string, unknown>;
  inject_teams?: string[];
  inject_assets?: string[];
  inject_asset_groups?: string[];
  inject_all_teams?: boolean;
  inject_tags?: string[];
}

/**
 * Payload creation input
 */
export interface PayloadCreateInput {
  payload_type: 'Command' | 'Executable' | 'FileDrop' | 'DnsResolution' | 'NetworkTraffic';
  payload_name: string;
  payload_source: 'COMMUNITY' | 'FILIGRAN' | 'MANUAL';
  payload_status: 'VERIFIED' | 'UNVERIFIED' | 'DEPRECATED';
  payload_platforms: string[];
  payload_execution_arch?: 'ALL_ARCHITECTURES' | 'x86_64' | 'arm64';
  payload_expectations?: string[];
  payload_description?: string;
  dns_resolution_hostname?: string;
  payload_attack_patterns?: string[];
  payload_tags?: string[];
}

