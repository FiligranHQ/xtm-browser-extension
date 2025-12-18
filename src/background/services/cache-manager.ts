/**
 * Cache Manager Service
 * 
 * Manages entity caches for OpenCTI and OpenAEV platforms.
 * Handles cache refresh scheduling, background refresh, and cache statistics.
 */

import { OpenCTIClient } from '../../shared/api/opencti-client';
import { OpenAEVClient } from '../../shared/api/openaev-client';
import { loggers } from '../../shared/utils/logger';
import type {
  OAEVAsset,
  OAEVAssetGroup,
  OAEVPlayer,
  OAEVTeam,
  OAEVAttackPattern,
  OAEVFinding,
} from '../../shared/types';
import {
  saveOCTICache,
  shouldRefreshOCTICache,
  createEmptyOCTICache,
  saveOAEVCache,
  shouldRefreshOAEVCache,
  createEmptyOAEVCache,
  type OCTIEntityCache,
  type CachedEntity,
  type OAEVCache,
} from '../../shared/utils/storage';
import { getOpenCTIClients, getOpenAEVClients } from './client-manager';

const log = loggers.background;

// ============================================================================
// Constants
// ============================================================================

const CACHE_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes (after successful cache creation)
const CACHE_RETRY_INTERVAL = 5 * 60 * 1000; // 5 minutes (if cache creation fails)

// ============================================================================
// State
// ============================================================================

// OpenCTI cache state
let octiCacheRefreshInterval: ReturnType<typeof setInterval> | null = null;
let isCacheRefreshing = false;
let allOCTICachesCreatedSuccessfully = false;

// OpenAEV cache state
let oaevCacheRefreshInterval: ReturnType<typeof setInterval> | null = null;
let isOAEVCacheRefreshing = false;
let allOAEVCachesCreatedSuccessfully = false;

// ============================================================================
// OpenCTI Cache Management
// ============================================================================

/**
 * Start periodic OpenCTI entity cache refresh for all platforms
 * Uses 5-minute interval until all caches are successfully created, then switches to 30 minutes
 */
export function startOCTICacheRefresh(): void {
  log.info('Starting OpenCTI entity cache refresh system...');
  
  // Clear existing interval if any
  if (octiCacheRefreshInterval) {
    clearInterval(octiCacheRefreshInterval);
  }
  
  // Initial refresh check - force immediate refresh on startup
  log.debug('Triggering initial OCTI cache check...');
  checkAndRefreshAllOCTICaches().then(() => {
    scheduleNextOCTICacheRefresh();
  });
}

/**
 * Schedule the next OCTI cache refresh based on whether all caches are successfully created
 */
function scheduleNextOCTICacheRefresh(): void {
  // Clear existing interval if any
  if (octiCacheRefreshInterval) {
    clearInterval(octiCacheRefreshInterval);
  }
  
  const interval = allOCTICachesCreatedSuccessfully ? CACHE_REFRESH_INTERVAL : CACHE_RETRY_INTERVAL;
  const intervalMinutes = interval / 60000;
  
  log.info(`OpenCTI entity cache refresh scheduled (every ${intervalMinutes} minutes${!allOCTICachesCreatedSuccessfully ? ' - retrying until success' : ''})`);
  
  octiCacheRefreshInterval = setInterval(async () => {
    await checkAndRefreshAllOCTICaches();
    // Re-evaluate interval after each check (switch to 30 min if now successful)
    if (!allOCTICachesCreatedSuccessfully) {
      // Still failing, keep current interval
    } else {
      // Now successful, switch to longer interval if we were on retry interval
      const currentInterval = allOCTICachesCreatedSuccessfully ? CACHE_REFRESH_INTERVAL : CACHE_RETRY_INTERVAL;
      if (currentInterval === CACHE_REFRESH_INTERVAL) {
        scheduleNextOCTICacheRefresh(); // Reschedule with the correct interval
      }
    }
  }, interval);
}

/**
 * Check and refresh caches for ALL configured OpenCTI platforms
 * @param forceRefresh - If true, refresh all caches regardless of age (also bypasses in-progress check)
 * @returns true if all caches are successfully created/refreshed
 */
export async function checkAndRefreshAllOCTICaches(forceRefresh: boolean = false): Promise<boolean> {
  const openCTIClients = getOpenCTIClients();
  
  if (openCTIClients.size === 0) {
    log.debug('No OpenCTI clients configured, skipping cache refresh');
    allOCTICachesCreatedSuccessfully = true; // No clients = nothing to fail
    return true;
  }
  
  // When force refresh is requested, wait for existing refresh to complete or skip the check
  if (isCacheRefreshing && !forceRefresh) {
    log.debug('OCTI cache refresh already in progress, skipping');
    return allOCTICachesCreatedSuccessfully;
  }
  
  // If force refresh while already refreshing, log but continue
  if (isCacheRefreshing && forceRefresh) {
    log.debug('Force OCTI refresh requested while refresh in progress, will proceed after current refresh');
    // Wait a bit for the current refresh to complete
    let waitAttempts = 0;
    while (isCacheRefreshing && waitAttempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitAttempts++;
    }
    if (isCacheRefreshing) {
      log.warn('Current OCTI refresh taking too long, proceeding anyway');
    }
  }
  
  isCacheRefreshing = true;
  log.debug(`${forceRefresh ? 'Force refreshing' : 'Checking'} cache for ${openCTIClients.size} OpenCTI platform(s)...`);
  
  let allSuccessful = true;
  
  try {
    for (const [platformId, client] of openCTIClients) {
      const needsRefresh = forceRefresh || await shouldRefreshOCTICache(platformId);
      if (needsRefresh) {
        log.debug(`OpenCTI cache for platform ${platformId} ${forceRefresh ? 'force' : 'needs'} refresh, starting...`);
        const success = await refreshOCTICacheForPlatform(platformId, client);
        if (!success) {
          allSuccessful = false;
        }
      } else {
        log.debug(`OpenCTI cache for platform ${platformId} is fresh`);
      }
    }
  } finally {
    isCacheRefreshing = false;
  }
  
  // Update global state based on results
  const wasSuccessful = allOCTICachesCreatedSuccessfully;
  allOCTICachesCreatedSuccessfully = allSuccessful;
  
  // If we just transitioned from failing to successful, reschedule with longer interval
  if (!wasSuccessful && allSuccessful) {
    log.info('All OCTI caches now successfully created, switching to 30-minute refresh interval');
    scheduleNextOCTICacheRefresh();
  }
  
  return allSuccessful;
}

/**
 * Refresh the OpenCTI entity cache for a specific platform
 * @returns true if cache was successfully created with at least some entities
 */
async function refreshOCTICacheForPlatform(platformId: string, client: OpenCTIClient): Promise<boolean> {
  log.debug(`Refreshing OpenCTI cache for platform ${platformId}...`);
  
  const cache: OCTIEntityCache = createEmptyOCTICache(platformId);
  let fetchErrors = 0;
  const totalFetchTypes = 16; // Number of entity types we fetch
  
  try {
    // Fetch each entity type in parallel for speed with better error logging
    const fetchWithLog = async (name: string, fetcher: () => Promise<Array<{ id: string; name: string; aliases?: string[]; x_mitre_id?: string }>>) => {
      try {
        const result = await fetcher();
        log.debug(`[${platformId}] Fetched ${result.length} ${name}`);
        return result;
      } catch (error) {
        log.error(`[${platformId}] Failed to fetch ${name}:`, error);
        fetchErrors++;
        return [];
      }
    };

    // Note: Vulnerabilities (CVEs) are NOT cached - they are too numerous and are searched in real-time
    const [
      threatActorGroups,
      threatActorIndividuals,
      intrusionSets,
      campaigns,
      incidents,
      malware,
      attackPatterns,
      sectors,
      organizations,
      individuals,
      events,
      countries,
      regions,
      cities,
      administrativeAreas,
      positions,
    ] = await Promise.all([
      fetchWithLog('Threat-Actor-Group', () => client.fetchThreatActorGroups()),
      fetchWithLog('Threat-Actor-Individual', () => client.fetchThreatActorIndividuals()),
      fetchWithLog('Intrusion-Set', () => client.fetchIntrusionSets()),
      fetchWithLog('Campaign', () => client.fetchCampaigns()),
      fetchWithLog('Incident', () => client.fetchIncidents()),
      fetchWithLog('Malware', () => client.fetchMalware()),
      fetchWithLog('Attack-Pattern', () => client.fetchAttackPatterns()),
      fetchWithLog('Sector', () => client.fetchSectors()),
      fetchWithLog('Organization', () => client.fetchOrganizations()),
      fetchWithLog('Individual', () => client.fetchIndividuals()),
      fetchWithLog('Event', () => client.fetchEvents()),
      fetchWithLog('Country', () => client.fetchCountries()),
      fetchWithLog('Region', () => client.fetchRegions()),
      fetchWithLog('City', () => client.fetchCities()),
      fetchWithLog('Administrative-Area', () => client.fetchAdministrativeAreas()),
      fetchWithLog('Position', () => client.fetchPositions()),
    ]);
    
    // Map to CachedEntity format (minimal data: id, name, aliases, x_mitre_id, type)
    const mapToCachedEntity = (
      entities: Array<{ id: string; name: string; aliases?: string[]; x_mitre_id?: string }>,
      type: string
    ): CachedEntity[] => entities.map(e => ({
      id: e.id,
      name: e.name,
      aliases: e.aliases,
      x_mitre_id: e.x_mitre_id, // MITRE ATT&CK ID for attack patterns
      type,
      platformId,
    }));
    
    cache.entities['Threat-Actor-Group'] = mapToCachedEntity(threatActorGroups, 'Threat-Actor-Group');
    cache.entities['Threat-Actor-Individual'] = mapToCachedEntity(threatActorIndividuals, 'Threat-Actor-Individual');
    cache.entities['Intrusion-Set'] = mapToCachedEntity(intrusionSets, 'Intrusion-Set');
    cache.entities['Campaign'] = mapToCachedEntity(campaigns, 'Campaign');
    cache.entities['Incident'] = mapToCachedEntity(incidents, 'Incident');
    cache.entities['Malware'] = mapToCachedEntity(malware, 'Malware');
    cache.entities['Attack-Pattern'] = mapToCachedEntity(attackPatterns, 'Attack-Pattern');
    // Note: Vulnerabilities are NOT cached - searched in real-time via CVE detection
    cache.entities['Sector'] = mapToCachedEntity(sectors, 'Sector');
    cache.entities['Organization'] = mapToCachedEntity(organizations, 'Organization');
    cache.entities['Individual'] = mapToCachedEntity(individuals, 'Individual');
    cache.entities['Event'] = mapToCachedEntity(events, 'Event');
    cache.entities['Country'] = mapToCachedEntity(countries, 'Country');
    cache.entities['Region'] = mapToCachedEntity(regions, 'Region');
    cache.entities['City'] = mapToCachedEntity(cities, 'City');
    cache.entities['Administrative-Area'] = mapToCachedEntity(administrativeAreas, 'Administrative-Area');
    cache.entities['Position'] = mapToCachedEntity(positions, 'Position');
    
    // Calculate totals
    let total = 0;
    for (const entities of Object.values(cache.entities)) {
      total += entities.length;
    }
    
    await saveOCTICache(cache, platformId);
    log.info(`[${platformId}] OpenCTI cache refreshed: ${total} entities cached`);
    
    // Consider success if we fetched at least some entities and didn't fail on all fetch types
    const success = total > 0 && fetchErrors < totalFetchTypes;
    if (!success) {
      log.warn(`[${platformId}] Cache refresh partially failed: ${fetchErrors}/${totalFetchTypes} fetch types failed, ${total} total entities`);
    }
    return success;
  } catch (error) {
    log.error(`[${platformId}] Failed to refresh OpenCTI cache:`, error);
    return false;
  }
}

/**
 * Force refresh the OpenCTI entity cache for all platforms
 */
export async function refreshOCTICache(): Promise<void> {
  await checkAndRefreshAllOCTICaches(true);
}

// ============================================================================
// OpenAEV Cache Management
// ============================================================================

/**
 * Start periodic OpenAEV entity cache refresh for all platforms
 * Uses 5-minute interval until all caches are successfully created, then switches to 30 minutes
 */
export function startOAEVCacheRefresh(): void {
  log.info('Starting OpenAEV entity cache refresh system...');
  
  // Clear existing interval if any
  if (oaevCacheRefreshInterval) {
    clearInterval(oaevCacheRefreshInterval);
  }
  
  // Initial refresh check - force immediate refresh on startup
  log.debug('Triggering initial OAEV cache check...');
  checkAndRefreshAllOAEVCaches().then(() => {
    scheduleNextOAEVCacheRefresh();
  });
}

/**
 * Schedule the next OAEV cache refresh based on whether all caches are successfully created
 */
function scheduleNextOAEVCacheRefresh(): void {
  // Clear existing interval if any
  if (oaevCacheRefreshInterval) {
    clearInterval(oaevCacheRefreshInterval);
  }
  
  const interval = allOAEVCachesCreatedSuccessfully ? CACHE_REFRESH_INTERVAL : CACHE_RETRY_INTERVAL;
  const intervalMinutes = interval / 60000;
  
  log.info(`OpenAEV entity cache refresh scheduled (every ${intervalMinutes} minutes${!allOAEVCachesCreatedSuccessfully ? ' - retrying until success' : ''})`);
  
  oaevCacheRefreshInterval = setInterval(async () => {
    await checkAndRefreshAllOAEVCaches();
    // Re-evaluate interval after each check (switch to 30 min if now successful)
    if (!allOAEVCachesCreatedSuccessfully) {
      // Still failing, keep current interval
    } else {
      // Now successful, switch to longer interval if we were on retry interval
      const currentInterval = allOAEVCachesCreatedSuccessfully ? CACHE_REFRESH_INTERVAL : CACHE_RETRY_INTERVAL;
      if (currentInterval === CACHE_REFRESH_INTERVAL) {
        scheduleNextOAEVCacheRefresh(); // Reschedule with the correct interval
      }
    }
  }, interval);
}

/**
 * Check and refresh OpenAEV cache for all platforms
 * @param forceRefresh - If true, refresh all caches regardless of age
 * @returns true if all caches are successfully created/refreshed
 */
export async function checkAndRefreshAllOAEVCaches(forceRefresh: boolean = false): Promise<boolean> {
  const openAEVClients = getOpenAEVClients();
  
  if (openAEVClients.size === 0) {
    log.debug('No OpenAEV clients configured, skipping cache refresh');
    allOAEVCachesCreatedSuccessfully = true; // No clients = nothing to fail
    return true;
  }

  // When force refresh is requested, wait for existing refresh to complete or skip the check
  if (isOAEVCacheRefreshing && !forceRefresh) {
    log.debug('OAEV cache refresh already in progress, skipping');
    return allOAEVCachesCreatedSuccessfully;
  }

  // If force refresh while already refreshing, log but continue
  if (isOAEVCacheRefreshing && forceRefresh) {
    log.debug('Force OAEV refresh requested while refresh in progress, will proceed after current refresh');
    // Wait a bit for the current refresh to complete
    let waitAttempts = 0;
    while (isOAEVCacheRefreshing && waitAttempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitAttempts++;
    }
    if (isOAEVCacheRefreshing) {
      log.warn('Current OAEV refresh taking too long, proceeding anyway');
    }
  }

  isOAEVCacheRefreshing = true;
  log.debug(`${forceRefresh ? 'Force refreshing' : 'Checking'} cache for ${openAEVClients.size} OpenAEV platform(s)...`);

  let allSuccessful = true;

  try {
    for (const [platformId, client] of openAEVClients) {
      const needsRefresh = forceRefresh || await shouldRefreshOAEVCache(platformId);
      if (needsRefresh) {
        log.debug(`OpenAEV cache for platform ${platformId} ${forceRefresh ? 'force' : 'needs'} refresh, starting...`);
        const success = await refreshOAEVCacheForPlatform(platformId, client);
        if (!success) {
          allSuccessful = false;
        }
      } else {
        log.debug(`OpenAEV cache for platform ${platformId} is fresh`);
      }
    }
  } finally {
    isOAEVCacheRefreshing = false;
  }

  // Update global state based on results
  const wasSuccessful = allOAEVCachesCreatedSuccessfully;
  allOAEVCachesCreatedSuccessfully = allSuccessful;

  // If we just transitioned from failing to successful, reschedule with longer interval
  if (!wasSuccessful && allSuccessful) {
    log.info('All OAEV caches now successfully created, switching to 30-minute refresh interval');
    scheduleNextOAEVCacheRefresh();
  }

  return allSuccessful;
}

/**
 * Refresh the OpenAEV cache for a specific platform
 * @returns true if cache was successfully created with at least some entities
 */
async function refreshOAEVCacheForPlatform(platformId: string, client: OpenAEVClient): Promise<boolean> {
  log.debug(`Refreshing OpenAEV cache for platform ${platformId}...`);
  
  const cache: OAEVCache = createEmptyOAEVCache(platformId);
  let fetchErrors = 0;
  const totalFetchTypes = 3; // Number of fetch operations (fetchAllEntitiesForCache, attackPatterns, findings)
  
  try {
    // Fetch all entities including attack patterns and findings
    let assets: OAEVAsset[] = [];
    let assetGroups: OAEVAssetGroup[] = [];
    let teams: OAEVTeam[] = [];
    let players: OAEVPlayer[] = [];
    let attackPatterns: OAEVAttackPattern[] = [];
    let findings: OAEVFinding[] = [];

    try {
      const entitiesResult = await client.fetchAllEntitiesForCache();
      assets = entitiesResult.assets;
      assetGroups = entitiesResult.assetGroups;
      teams = entitiesResult.teams;
      players = entitiesResult.players;
    } catch (error) {
      log.error(`[${platformId}] Failed to fetch OAEV entities:`, error);
      fetchErrors++;
    }

    try {
      attackPatterns = await client.getAllAttackPatterns();
    } catch (error) {
      log.error(`[${platformId}] Failed to fetch OAEV attack patterns:`, error);
      fetchErrors++;
    }

    try {
      findings = await client.getAllFindings();
    } catch (error) {
      log.error(`[${platformId}] Failed to fetch OAEV findings:`, error);
      fetchErrors++;
    }
    
    log.info(`[${platformId}] Fetched ${assets.length} Assets, ${assetGroups.length} AssetGroups, ${teams.length} Teams, ${players.length} Players, ${attackPatterns.length} AttackPatterns, ${findings.length} Findings`);
    
    // Debug: Log first few raw assets to see field names
    if (assets.length > 0) {
      log.debug(`[${platformId}] First raw asset:`, assets[0]);
    }
    
    // Map assets (endpoints) - match on NAME, HOSTNAME, IPs, or MAC addresses (exact match)
    // Note: API may return endpoint_name OR asset_name - use whichever is available
    cache.entities['Asset'] = assets.map(a => {
      // Primary name: prefer endpoint_name, fall back to asset_name
      const primaryName = a.endpoint_name || a.asset_name;
      const hostname = a.endpoint_hostname || a.asset_hostname;
      const ips = a.endpoint_ips || a.asset_ips || [];
      const aliases: string[] = [];
      
      // Add the alternate name field as alias if different
      if (a.asset_name && a.endpoint_name && a.asset_name.toLowerCase() !== a.endpoint_name.toLowerCase()) {
        aliases.push(a.asset_name);
      }
      
      // Add hostname as alias if different from name
      if (hostname && hostname.toLowerCase() !== primaryName?.toLowerCase()) {
        aliases.push(hostname);
      }
      
      // Add all IP addresses as aliases
      for (const ip of ips) {
        if (ip && ip.length >= 7) { // Minimum valid IP length (e.g., "1.1.1.1")
          aliases.push(ip);
        }
      }
      
      // Add MAC address if available (from endpoint data)
      const macAddress = (a as { endpoint_mac_addresses?: string[]; asset_mac_address?: string }).endpoint_mac_addresses?.[0] 
        || (a as { asset_mac_address?: string }).asset_mac_address;
      if (macAddress && macAddress.length >= 12) {
        aliases.push(macAddress);
      }
      
      const assetId = a.endpoint_id || a.asset_id;
      
      log.debug(`[${platformId}] Caching asset: name="${primaryName}", id="${assetId}", aliases=${JSON.stringify(aliases)}`);
      
      return {
        id: assetId,
        name: primaryName,
        aliases: aliases.length > 0 ? aliases : undefined,
        type: 'Asset' as const,
        platformId,
      };
    });
    
    // Map asset groups - match on NAME only
    cache.entities['AssetGroup'] = assetGroups.map(g => ({
      id: g.asset_group_id,
      name: g.asset_group_name,
      type: 'AssetGroup' as const,
      platformId,
    }));
    
    // Map teams - match on NAME only (exact match)
    cache.entities['Team'] = teams.map(t => ({
      id: t.team_id,
      name: t.team_name,
      type: 'Team' as const,
      platformId,
    }));
    
    // Map players - match on NAME or EMAIL only (exact match)
    // No phone numbers - they would cause false positives
    cache.entities['Player'] = players.map(p => {
      const fullName = `${p.user_firstname || ''} ${p.user_lastname || ''}`.trim();
      const name = fullName || p.user_email;
      const aliases: string[] = [];
      // Add email as alias if we have a name and it's different from the email
      if (fullName && p.user_email && p.user_email.toLowerCase() !== fullName.toLowerCase()) {
        aliases.push(p.user_email);
      }
      return {
        id: p.user_id,
        name,
        aliases: aliases.length > 0 ? aliases : undefined,
        type: 'Player' as const,
        platformId,
      };
    });
    
    // Map attack patterns - match on NAME or EXTERNAL_ID (e.g., T1059) (exact match)
    cache.entities['AttackPattern'] = attackPatterns.map(ap => ({
      id: ap.attack_pattern_id,
      name: ap.attack_pattern_name,
      aliases: ap.attack_pattern_external_id ? [ap.attack_pattern_external_id] : undefined,
      type: 'AttackPattern' as const,
      platformId,
    }));
    
    // Map findings - match on finding_value (the main attribute for matching)
    cache.entities['Finding'] = findings.map(f => ({
      id: f.finding_id,
      name: f.finding_value, // Match on the finding value
      type: 'Finding' as const,
      platformId,
    }));
    
    // Calculate totals
    let total = 0;
    for (const entities of Object.values(cache.entities)) {
      total += entities.length;
    }
    
    await saveOAEVCache(cache, platformId);
    log.info(`[${platformId}] OpenAEV cache refreshed: ${total} entities cached`);
    
    // Consider success if we fetched at least some entities and didn't fail on all fetch types
    const success = total > 0 && fetchErrors < totalFetchTypes;
    if (!success) {
      log.warn(`[${platformId}] OAEV cache refresh partially failed: ${fetchErrors}/${totalFetchTypes} fetch types failed, ${total} total entities`);
    }
    return success;
  } catch (error) {
    log.error(`[${platformId}] Failed to refresh OpenAEV cache:`, error);
    return false;
  }
}

/**
 * Force refresh the OpenAEV cache for all platforms
 */
export async function refreshOAEVCache(): Promise<void> {
  await checkAndRefreshAllOAEVCaches(true);
}

// ============================================================================
// Cache Status
// ============================================================================

/**
 * Get cache refresh status
 */
export function getCacheRefreshStatus(): { octi: boolean; oaev: boolean } {
  return {
    octi: isCacheRefreshing,
    oaev: isOAEVCacheRefreshing,
  };
}

/**
 * Stop all cache refresh intervals
 */
export function stopCacheRefresh(): void {
  if (octiCacheRefreshInterval) {
    clearInterval(octiCacheRefreshInterval);
    octiCacheRefreshInterval = null;
  }
  if (oaevCacheRefreshInterval) {
    clearInterval(oaevCacheRefreshInterval);
    oaevCacheRefreshInterval = null;
  }
  log.info('All cache refresh intervals stopped');
}
