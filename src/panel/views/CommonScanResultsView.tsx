/**
 * Scan Results View Component
 * 
 * Displays scan results with filtering, selection, and import functionality.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Tooltip,
  Tab,
  Tabs,
} from '@mui/material';
import {
  CenterFocusStrongOutlined,
  SearchOutlined,
  ChevronLeftOutlined,
  LayersClearOutlined,
} from '@mui/icons-material';
import type { ScanResultsViewProps } from '../types/view-props';
import type { EntityData, MultiPlatformResult } from '../types/panel-types';
import type { ScanResultEntity } from '../../shared/types/scan';
import type { ResolvedRelationship } from '../../shared/api/ai/types';
import { loggers } from '../../shared/utils/logger';
import { generateDescription, cleanHtmlContent } from '../utils/description-helpers';
import { getAiColor } from '../utils/platform-helpers';
import { isDefaultPlatform } from '../../shared/platform/registry';
import { broadcastAIEntities, formatEntityCountMessage } from '../utils/ai-entity-helpers';
import {
  isSelectableForOpenCTI,
  isFoundInOpenCTI,
  filterEntities,
  getPageContent,
  buildEntitiesForAI,
} from '../utils/scan-results-helpers';
import { ScanResultsEntityItem } from '../components/scan-results/ScanResultsEntityItem';
import { ScanResultsAIButtons } from '../components/scan-results/ScanResultsAIButtons';
import { ScanResultsSelectionActions } from '../components/scan-results/ScanResultsSelectionActions';
import { ScanResultsRelationshipItem } from '../components/scan-results/ScanResultsRelationshipItem';
import { ScanResultsFilters } from '../components/scan-results/ScanResultsFilters';

const log = loggers.panel;

interface ExtendedScanResultsViewProps extends Omit<ScanResultsViewProps, 'showToast' | 'entitiesToAdd' | 'setContainerWorkflowOrigin'> {
  /** Show toast notification */
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    action?: { label: string; type: 'scroll_to_first' | 'close_panel' | 'custom' };
    persistent?: boolean;
    duration?: number;
  }) => void;
  /** Container form state setter */
  setContainerForm: (form: { name: string; description: string; content: string }) => void;
  /** Current page title */
  currentPageTitle: string;
  /** Current page URL */
  currentPageUrl: string;
  /** Set current page URL */
  setCurrentPageUrl: (url: string) => void;
  /** Set current page title */
  setCurrentPageTitle: (title: string) => void;
  /** Set current PDF file name */
  setCurrentPdfFileName: (name: string) => void;
  /** Set isPdfSource flag */
  setIsPdfSource: (isPdf: boolean) => void;
  /** Logo suffix based on theme */
  logoSuffix: string;
  /** Loading entity details state */
  entityDetailsLoading?: boolean;
  /** Set loading entity details state */
  setEntityDetailsLoading?: (loading: boolean) => void;
  /** Fetch containers for an entity (OpenCTI only) */
  fetchEntityContainers?: (entityId: string, platformId?: string) => Promise<void>;
  /** AI resolving relationships state */
  aiResolvingRelationships: boolean;
  /** Set AI resolving relationships */
  setAiResolvingRelationships: (resolving: boolean) => void;
  /** Resolved relationships from AI */
  resolvedRelationships: ResolvedRelationship[];
  /** Set resolved relationships */
  setResolvedRelationships: (relationships: ResolvedRelationship[] | ((prev: ResolvedRelationship[]) => ResolvedRelationship[])) => void;
}

export const CommonScanResultsView: React.FC<ExtendedScanResultsViewProps> = ({
  mode,
  scanResultsEntities,
  setScanResultsEntities,
  scanResultsTypeFilter,
  setScanResultsTypeFilter,
  scanResultsFoundFilter,
  setScanResultsFoundFilter,
  selectedScanItems,
  setSelectedScanItems,
  setPanelMode,
  setEntitiesToAdd,
  setEntity,
  setMultiPlatformResults,
  setCurrentPlatformIndex,
  setEntityFromScanResults,
  currentPlatformIndexRef,
  multiPlatformResultsRef,
  aiSettings,
  aiDiscoveringEntities,
  setAiDiscoveringEntities,
  aiResolvingRelationships,
  setAiResolvingRelationships,
  resolvedRelationships,
  setResolvedRelationships,
  availablePlatforms,
  showToast,
  setContainerForm,
  currentPageTitle,
  currentPageUrl,
  setCurrentPageUrl,
  setCurrentPageTitle,
  setCurrentPdfFileName,
  setIsPdfSource,
  scanPageContent,
  setEntityDetailsLoading,
  fetchEntityContainers,
}) => {
  // Local state for search query
  const [searchQuery, setSearchQuery] = useState('');
  // Tab state for entities/relationships (0 = entities, 1 = relationships)
  const [activeTab, setActiveTab] = useState(0);
  // Track when "Scan all" is specifically running (vs individual scans)
  const [scanAllRunning, setScanAllRunning] = useState(false);

  // Calculate statistics
  const scanResultsFoundCount = useMemo(() => 
    scanResultsEntities.filter(e => e.found && !e.discoveredByAI).length,
    [scanResultsEntities]
  );
  
  const scanResultsNotFoundCount = useMemo(() => 
    scanResultsEntities.filter(e => !e.found && !e.discoveredByAI).length,
    [scanResultsEntities]
  );
  
  const scanResultsAICount = useMemo(() => 
    scanResultsEntities.filter(e => e.discoveredByAI).length,
    [scanResultsEntities]
  );

  // Filter entities based on current filters
  const filteredScanResultsEntities = useMemo(() => {
    return filterEntities(scanResultsEntities, scanResultsFoundFilter, scanResultsTypeFilter, searchQuery);
  }, [scanResultsEntities, scanResultsFoundFilter, scanResultsTypeFilter, searchQuery]);

  // Handle entity click - navigate to entity view
  const handleScanResultEntityClick = async (entity: ScanResultEntity) => {
    // Build multi-platform results from platformMatches
    const results: MultiPlatformResult[] = [];
    
    if (entity.platformMatches && entity.platformMatches.length > 0) {
      // Use platformMatches for multi-platform support
      for (const match of entity.platformMatches) {
        // Try to find platform by ID first, then fall back to platformType match
        let platform = availablePlatforms.find(p => p.id === match.platformId);
        if (!platform && match.platformType) {
          // Fall back to finding any platform of the same type
          platform = availablePlatforms.find(p => p.type === match.platformType);
        }
        
        if (platform) {
          results.push({
            platformId: platform.id, // Use the found platform's ID
            platformName: platform.name,
            entity: {
              ...entity,
              entityId: match.entityId,
              entityData: match.entityData,
              type: match.type,
              platformId: platform.id,
              platformType: match.platformType || platform.type,
              isNonDefaultPlatform: (match.platformType || platform.type) !== 'opencti',
            } as EntityData,
          });
        }
      }
    } else if (entity.found && entity.platformId) {
      // Single-platform entity (no multi-platform matches)
      const platform = availablePlatforms.find(p => p.id === entity.platformId);
      if (platform) {
        results.push({
          platformId: entity.platformId,
          platformName: platform.name,
          entity: {
            ...entity,
            platformId: entity.platformId,
            platformType: entity.platformType || 'opencti',
            isNonDefaultPlatform: entity.platformType !== 'opencti',
          } as EntityData,
        });
      }
    } else if (!entity.found) {
      // Entity not found in any platform - show as "not found" with basic info
      results.push({
        platformId: '',
        platformName: 'Not Found',
        entity: {
          id: entity.id,
          type: entity.type,
          name: entity.name,
          value: entity.value,
          existsInPlatform: false,
        } as EntityData,
      });
    }

    // Update refs and state
    multiPlatformResultsRef.current = results;
    currentPlatformIndexRef.current = 0;
    
    setMultiPlatformResults(results);
    setCurrentPlatformIndex(0);
    // Use explicit type conversion for entity fallback
    const fallbackEntity: EntityData = {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      value: entity.value,
      existsInPlatform: entity.found,
    };
    const initialEntity = results[0]?.entity || fallbackEntity;
    setEntity(initialEntity);
    setEntityFromScanResults(true);
    
    // Set panel mode
    const isFound = results.length > 0 && results[0].entity.existsInPlatform !== false;
    setPanelMode(isFound ? 'entity' : 'not-found');
    
    // If entity was found, fetch full details from the platform
    if (isFound && results[0]) {
      const firstResult = results[0];
      const entityId = (firstResult.entity as any).entityId || (firstResult.entity as any).id;
      const entityType = firstResult.entity.type || entity.type;
      const platformId = firstResult.platformId;
      const platformType = (firstResult.entity as any).platformType || 'opencti';
      
      if (entityId && platformId) {
        try {
          // Set loading state
          setEntityDetailsLoading?.(true);
          
          // Fetch full entity details from platform
          chrome.runtime.sendMessage({
            type: 'GET_ENTITY_DETAILS',
            payload: {
              id: entityId,
              entityType: entityType,
              platformId: platformId,
              platformType: platformType,
            },
          }, (response) => {
            if (chrome.runtime.lastError) {
              log.debug('Entity details fetch error:', chrome.runtime.lastError);
              setEntityDetailsLoading?.(false);
              return;
            }
            
            // Only update if we got a successful response with data
            if (response?.success && response.data) {
              const fullEntityData = response.data;
              
              // Update the entity with full details, preserving platform metadata and type
              // IMPORTANT: entityType and entityData must be preserved for view rendering
              const updatedEntity: EntityData = {
                ...fullEntityData,
                // Preserve the entity type - API response may not include 'type' field
                type: entityType,
                entity_type: entityType.replace('oaev-', ''),
                // Store API response in entityData for views that read from it
                entityData: fullEntityData,
                // Platform metadata
                platformId: platformId,
                platformType: platformType,
                isNonDefaultPlatform: platformType !== 'opencti',
                existsInPlatform: true,
              };
              
              setEntity(updatedEntity);
              
              // Also update the multi-platform results
              const updatedResults = [...results];
              if (updatedResults[0]) {
                updatedResults[0] = {
                  ...updatedResults[0],
                  entity: updatedEntity,
                };
                setMultiPlatformResults(updatedResults);
                multiPlatformResultsRef.current = updatedResults;
              }
              
              // Fetch containers for OpenCTI entities
              if (platformType === 'opencti' && fetchEntityContainers) {
                fetchEntityContainers(entityId, platformId);
              }
              
              log.debug('Entity details fetched successfully for:', entityId);
            } else {
              log.debug('Entity details fetch failed or no data:', response?.error);
            }
            setEntityDetailsLoading?.(false);
          });
        } catch (error) {
          log.debug('Failed to fetch entity details:', error);
          setEntityDetailsLoading?.(false);
        }
      }
    }
  };

  // Handle AI entity discovery
  const handleDiscoverEntitiesWithAI = async () => {
    if (!aiSettings.available) {
      showToast({ type: 'warning', message: 'AI is not configured. Go to Settings → Agentic AI to enable.' });
      return;
    }

    const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);
    if (!hasEnterprisePlatform) {
      showToast({ type: 'warning', message: 'Requires at least one Enterprise Edition platform' });
      return;
    }

    setAiDiscoveringEntities(true);

    try {
      // Get page content using shared helper
      const { content: pageContent, title: pageTitle, url: pageUrl } = await getPageContent(
        scanPageContent,
        currentPageTitle || '',
        currentPageUrl || ''
      );

      if (!pageContent) {
        showToast({ type: 'error', message: 'Could not get page content for AI analysis' });
        setAiDiscoveringEntities(false);
        return;
      }

      // Get existing entities for context using shared helper
      const alreadyDetected = buildEntitiesForAI(scanResultsEntities);

      // Call AI discovery
      chrome.runtime.sendMessage(
        {
          type: 'AI_DISCOVER_ENTITIES',
          payload: {
            pageTitle,
            pageUrl,
            pageContent,
            alreadyDetected,
          },
        },
        (response) => {
          setAiDiscoveringEntities(false);

          if (chrome.runtime.lastError) {
            log.error('AI discovery error:', chrome.runtime.lastError);
            showToast({ type: 'error', message: 'AI discovery failed' });
            return;
          }

          if (response?.success && response.data?.entities) {
            const newEntities: ScanResultEntity[] = response.data.entities.map((e: { type: string; value: string; reason?: string; confidence?: string }, i: number) => ({
              id: `ai-${Date.now()}-${i}`,
              type: e.type,
              name: e.value,
              value: e.value,
              found: false,
              discoveredByAI: true,
              aiReason: e.reason,
              aiConfidence: e.confidence as 'high' | 'medium' | 'low' | undefined,
            }));

            if (newEntities.length > 0) {
              // Try to highlight AI-discovered entities and only add those that can be highlighted
              (async () => {
                try {
                  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                  if (tab?.id) {
                    chrome.tabs.sendMessage(
                      tab.id, 
                      {
                        type: 'XTM_HIGHLIGHT_AI_ENTITIES',
                        payload: {
                          entities: newEntities.map(e => ({
                            type: e.type,
                            value: e.value,
                            name: e.name,
                          })),
                        },
                      },
                      (highlightResponse) => {
                        // Filter to only include entities that were successfully highlighted
                        const highlightedValues = new Set(
                          (highlightResponse?.highlightedEntities || []).map((e: { value: string; name: string }) => e.value || e.name)
                        );
                        
                        const visibleEntities = newEntities.filter(e => 
                          highlightedValues.has(e.value || e.name)
                        );
                        
                        if (visibleEntities.length > 0) {
                          // Put AI-discovered entities at the TOP of the list for visibility
                          setScanResultsEntities((prev: ScanResultEntity[]) => [...visibleEntities, ...prev]);
                          // Broadcast to content script and PDF scanner
                          broadcastAIEntities(visibleEntities);
                          const notVisibleCount = newEntities.length - visibleEntities.length;
                          showToast({ 
                            type: 'success', 
                            message: formatEntityCountMessage(visibleEntities.length) + (
                              notVisibleCount > 0 ? ` (${notVisibleCount} not visible on page)` : ''
                            )
                          });
                        } else if (newEntities.length > 0) {
                          // AI found entities but none could be highlighted
                          showToast({ type: 'info', message: `AI found ${newEntities.length} entities but none are visible on the page` });
                        } else {
                          showToast({ type: 'info', message: 'AI found no additional entities' });
                        }
                      }
                    );
                  } else {
                    // No tab - add all entities at TOP (can't verify highlighting)
                    setScanResultsEntities((prev: ScanResultEntity[]) => [...newEntities, ...prev]);
                    broadcastAIEntities(newEntities);
                    showToast({ type: 'success', message: formatEntityCountMessage(newEntities.length) });
                  }
                } catch {
                  // On error, add all entities at TOP (fallback)
                  setScanResultsEntities((prev: ScanResultEntity[]) => [...newEntities, ...prev]);
                  broadcastAIEntities(newEntities);
                  showToast({ type: 'success', message: formatEntityCountMessage(newEntities.length) });
                }
              })();
            } else {
              showToast({ type: 'info', message: 'AI found no additional entities' });
            }
          } else {
            log.warn('AI discovery failed:', response?.error);
            showToast({ type: 'error', message: response?.error || 'AI discovery failed' });
          }
        }
      );
    } catch (error) {
      log.error('AI discovery error:', error);
      showToast({ type: 'error', message: 'AI discovery error' });
      setAiDiscoveringEntities(false);
    }
  };

  // Handle AI relationship discovery
  const handleDiscoverRelationshipsWithAI = async () => {
    if (!aiSettings.available) {
      showToast({ type: 'warning', message: 'AI is not configured. Go to Settings → Agentic AI to enable.' });
      return;
    }

    const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);
    if (!hasEnterprisePlatform) {
      showToast({ type: 'warning', message: 'Requires at least one Enterprise Edition platform' });
      return;
    }

    // Need at least 2 entities to find relationships
    if (scanResultsEntities.length < 2) {
      showToast({ type: 'info', message: 'Need at least 2 entities to discover relationships' });
      return;
    }

    setAiResolvingRelationships(true);

    try {
      // Get page content using shared helper
      const { content: pageContent, title: pageTitle, url: pageUrl } = await getPageContent(
        scanPageContent,
        currentPageTitle || '',
        currentPageUrl || ''
      );

      if (!pageContent) {
        showToast({ type: 'error', message: 'Could not get page content for AI analysis' });
        setAiResolvingRelationships(false);
        return;
      }

      // Build entities array for AI - only OpenCTI entities (not oaev-* types)
      // Filter out OpenAEV-only entities as relationships are only for OpenCTI
      const octiEntities = scanResultsEntities.filter(e => !e.type.startsWith('oaev-'));
      const entities = octiEntities.map(e => ({
        type: e.type,
        name: e.name || e.value || '',
        value: e.value,
        existsInPlatform: e.found || false,
        octiEntityId: e.entityId,
      }));

      // Call AI to resolve relationships
      chrome.runtime.sendMessage(
        {
          type: 'AI_RESOLVE_RELATIONSHIPS',
          payload: {
            pageTitle,
            pageUrl,
            pageContent,
            entities,
          },
        },
        (response) => {
          setAiResolvingRelationships(false);

          if (chrome.runtime.lastError) {
            log.error('AI relationship resolution error:', chrome.runtime.lastError);
            showToast({ type: 'error', message: 'AI relationship resolution failed' });
            return;
          }

          if (response?.success && response.data?.relationships) {
            // The handler should enrich relationships with fromEntityValue/toEntityValue,
            // but add defensive enrichment in case indices are present without values
            const octiEntities = scanResultsEntities.filter(e => !e.type.startsWith('oaev-'));
            const enrichedRelationships = response.data.relationships.map((rel: ResolvedRelationship) => {
              // If already has values, use them; otherwise look up by index
              if (rel.fromEntityValue && rel.toEntityValue) {
                return rel;
              }
              const fromEntity = octiEntities[rel.fromIndex];
              const toEntity = octiEntities[rel.toIndex];
              return {
                ...rel,
                fromEntityValue: rel.fromEntityValue || fromEntity?.value || fromEntity?.name || '',
                toEntityValue: rel.toEntityValue || toEntity?.value || toEntity?.name || '',
              };
            });
            setResolvedRelationships(enrichedRelationships);
            log.info(`AI resolved ${enrichedRelationships.length} relationships`);
            if (enrichedRelationships.length > 0) {
              showToast({ type: 'success', message: `AI found ${enrichedRelationships.length} relationship${enrichedRelationships.length === 1 ? '' : 's'}` });
              // Switch to relationships tab
              setActiveTab(1);
            } else {
              showToast({ type: 'info', message: 'AI found no relationships' });
            }
          } else {
            log.warn('AI relationship resolution failed:', response?.error);
            showToast({ type: 'error', message: response?.error || 'AI relationship resolution failed' });
          }
        }
      );
    } catch (error) {
      log.error('AI relationship resolution error:', error);
      showToast({ type: 'error', message: 'AI relationship resolution error' });
      setAiResolvingRelationships(false);
    }
  };

  // Handle AI scan all (entities + relationships at once)
  const handleScanAllWithAI = async () => {
    if (!aiSettings.available) {
      showToast({ type: 'warning', message: 'AI is not configured. Go to Settings → Agentic AI to enable.' });
      return;
    }

    const hasEnterprisePlatform = availablePlatforms.some(p => p.isEnterprise);
    if (!hasEnterprisePlatform) {
      showToast({ type: 'warning', message: 'Requires at least one Enterprise Edition platform' });
      return;
    }

    setScanAllRunning(true);
    setAiDiscoveringEntities(true);
    setAiResolvingRelationships(true);

    try {
      // Get page content using shared helper
      const { content: pageContent, title: pageTitle, url: pageUrl } = await getPageContent(
        scanPageContent,
        currentPageTitle || '',
        currentPageUrl || ''
      );

      if (!pageContent) {
        showToast({ type: 'error', message: 'Could not get page content for AI analysis' });
        setScanAllRunning(false);
        setAiDiscoveringEntities(false);
        setAiResolvingRelationships(false);
        return;
      }

      // Get existing entities for context using shared helper
      const alreadyDetected = buildEntitiesForAI(scanResultsEntities).map(e => ({
        ...e,
        existsInPlatform: scanResultsEntities.find(se => (se.value || se.name) === e.value)?.found || false,
        octiEntityId: scanResultsEntities.find(se => (se.value || se.name) === e.value)?.entityId,
      }));

      // Call AI to scan all (entities + relationships)
      chrome.runtime.sendMessage(
        {
          type: 'AI_SCAN_ALL',
          payload: {
            pageTitle,
            pageUrl,
            pageContent,
            alreadyDetected,
          },
        },
        (response) => {
          setScanAllRunning(false);
          setAiDiscoveringEntities(false);
          setAiResolvingRelationships(false);

          if (chrome.runtime.lastError) {
            log.error('AI scan all error:', chrome.runtime.lastError);
            showToast({ type: 'error', message: 'AI scan failed' });
            return;
          }

          if (response?.success && response.data) {
            const { entities: newEntitiesRaw, relationships: newRelationships } = response.data;
            
            // Relationships from AI_SCAN_ALL already have fromEntityValue and toEntityValue set by the backend
            // We just need to ensure they're valid (not empty)
            
            // Process new entities
            if (newEntitiesRaw && newEntitiesRaw.length > 0) {
              const newEntities: ScanResultEntity[] = newEntitiesRaw.map((e: { type: string; value: string; reason?: string; confidence?: string }, i: number) => ({
                id: `ai-${Date.now()}-${i}`,
                type: e.type,
                name: e.value,
                value: e.value,
                found: false,
                discoveredByAI: true,
                aiReason: e.reason,
                aiConfidence: e.confidence as 'high' | 'medium' | 'low' | undefined,
              }));

              // Try to highlight AI-discovered entities
              (async () => {
                try {
                  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                  if (tab?.id) {
                    chrome.tabs.sendMessage(
                      tab.id, 
                      {
                        type: 'XTM_HIGHLIGHT_AI_ENTITIES',
                        payload: {
                          entities: newEntities.map(e => ({
                            type: e.type,
                            value: e.value,
                            name: e.name,
                          })),
                        },
                      },
                      (highlightResponse) => {
                        const highlightedValues = new Set(
                          (highlightResponse?.highlightedEntities || []).map((e: { value: string; name: string }) => e.value || e.name)
                        );
                        
                        const visibleEntities = newEntities.filter(e => 
                          highlightedValues.has(e.value || e.name)
                        );
                        
                        if (visibleEntities.length > 0) {
                          // Put AI-discovered entities at the TOP of the list for visibility
                          setScanResultsEntities((prev: ScanResultEntity[]) => [...visibleEntities, ...prev]);
                          broadcastAIEntities(visibleEntities);
                        }
                        
                        // Process relationships - values are already set by backend
                        processRelationshipsFromScanAll(newRelationships, visibleEntities.length);
                      }
                    );
                  } else {
                    // Put AI-discovered entities at the TOP of the list for visibility
                    setScanResultsEntities((prev: ScanResultEntity[]) => [...newEntities, ...prev]);
                    processRelationshipsFromScanAll(newRelationships, newEntities.length);
                  }
                } catch {
                  // Put AI-discovered entities at the TOP of the list for visibility
                  setScanResultsEntities((prev: ScanResultEntity[]) => [...newEntities, ...prev]);
                  processRelationshipsFromScanAll(newRelationships, newEntities.length);
                }
              })();
            } else {
              // No new entities, just process relationships
              processRelationshipsFromScanAll(newRelationships, 0);
            }
          } else {
            log.warn('AI scan all failed:', response?.error);
            showToast({ type: 'error', message: response?.error || 'AI scan failed' });
          }
        }
      );
    } catch (error) {
      log.error('AI scan all error:', error);
      showToast({ type: 'error', message: 'AI scan error' });
      setScanAllRunning(false);
      setAiDiscoveringEntities(false);
      setAiResolvingRelationships(false);
    }
  };

  // Helper to process relationships from scan all response
  const processRelationshipsFromScanAll = (newRelationships: ResolvedRelationship[] | undefined, newEntitiesCount: number) => {
    if (newRelationships && newRelationships.length > 0) {
      setResolvedRelationships(newRelationships);
      
      const entityMsg = newEntitiesCount > 0 ? `${newEntitiesCount} entities` : '';
      const relMsg = `${newRelationships.length} relationship${newRelationships.length === 1 ? '' : 's'}`;
      const message = entityMsg ? `AI found ${entityMsg} and ${relMsg}` : `AI found ${relMsg}`;
      
      showToast({ type: 'success', message });
      if (newRelationships.length > 0) {
        setActiveTab(1);
      }
    } else if (newEntitiesCount > 0) {
      showToast({ type: 'success', message: `AI discovered ${newEntitiesCount} entities, no relationships found` });
    } else {
      showToast({ type: 'info', message: 'AI found no additional entities or relationships' });
    }
  };

  // Handle import of selected scan results
  const handleImportSelectedScanResults = async () => {
    // Get selected entities (filter by selection set)
    const selectedEntities = filteredScanResultsEntities.filter(e => {
      const entityValue = e.value || e.name;
      return selectedScanItems.has(entityValue);
    });

    if (selectedEntities.length === 0) {
      showToast({ type: 'warning', message: 'No entities selected for import' });
      return;
    }

    // Convert to EntityData format for container creation
    const entitiesToImport: EntityData[] = selectedEntities.map(e => {
      // For entities found in OpenCTI (the default platform), get the OpenCTI entity ID
      const octiMatch = e.platformMatches?.find(pm => pm.platformType === 'opencti');
      const octiEntityId = octiMatch?.entityId || (isDefaultPlatform(e.platformType as 'opencti' | 'openaev' | 'opengrc') ? e.entityId : undefined);
      
      return {
        type: e.type,
        name: e.name,
        value: e.value,
        existsInPlatform: isFoundInOpenCTI(e),
        id: octiEntityId,
        octiEntityId: octiEntityId,
      } as EntityData;
    });

    // Get page content for container form (handles PDF scanner or regular web page)
    const { content: pageContent, title: pageTitle, url: pageUrl, pdfFileName, isPdfSource } = 
      await getPageContent(scanPageContent, currentPageTitle || document.title, currentPageUrl || '');

    // Generate description from page content
    const description = pageContent ? generateDescription(pageContent) : '';

    // Set container form with page info
    // For PDF source, pageTitle is already the PDF title (not "Filigran XTM - PDF scanner")
    setContainerForm({
      name: pageTitle,
      description: description,
      content: cleanHtmlContent(pageContent),
    });

    // Set entities and PDF info
    setEntitiesToAdd(entitiesToImport);
    setCurrentPageUrl(pageUrl);
    setCurrentPageTitle(pageTitle);
    setCurrentPdfFileName(pdfFileName || '');
    setIsPdfSource(isPdfSource || false);
    setPanelMode('preview');
  };

  const aiColors = getAiColor(mode);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Back to actions button */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={() => setPanelMode('empty')}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back to actions
        </Button>
      </Box>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CenterFocusStrongOutlined sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          Scan Results
        </Typography>
        <Tooltip title="Clear all results and highlights" placement="top">
          <Button
            size="small"
            variant="outlined"
            startIcon={<LayersClearOutlined sx={{ fontSize: '1rem' }} />}
            onClick={() => {
              // Clear highlights only (without triggering redirect) - use CLEAR_HIGHLIGHTS_ONLY
              window.parent.postMessage({ type: 'XTM_CLEAR_HIGHLIGHTS_ONLY' }, '*');
              // Also try to clear via chrome tabs message for regular pages
              if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
                chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
                  if (tab?.id) {
                    // Use CLEAR_HIGHLIGHTS_ONLY for content script on regular pages (no redirect)
                    chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS_ONLY' }).catch(() => {});
                  }
                }).catch(() => {});
              }
              // Clear results and selections locally (stay on scan-results view)
              setScanResultsEntities([]);
              setSelectedScanItems(new Set());
              setResolvedRelationships([]);
              // Reset filters
              setScanResultsTypeFilter('all');
              setScanResultsFoundFilter('all');
            }}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              py: 0.25,
              px: 1,
              color: 'text.secondary',
              borderColor: 'grey.400',
              '&:hover': { 
                bgcolor: 'action.hover',
              },
            }}
          >
            Clear
          </Button>
        </Tooltip>
      </Box>

      {/* Stats and Filters */}
      <ScanResultsFilters
        scanResultsEntities={scanResultsEntities}
        scanResultsTypeFilter={scanResultsTypeFilter}
        setScanResultsTypeFilter={setScanResultsTypeFilter}
        scanResultsFoundFilter={scanResultsFoundFilter}
        setScanResultsFoundFilter={setScanResultsFoundFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        scanResultsFoundCount={scanResultsFoundCount}
        scanResultsNotFoundCount={scanResultsNotFoundCount}
        scanResultsAICount={scanResultsAICount}
        aiColors={aiColors}
      />

          {/* AI Discovery buttons - Entities, Relations, and Scan All */}
          <ScanResultsAIButtons
            aiSettings={aiSettings}
            aiColors={aiColors}
            availablePlatforms={availablePlatforms}
            scanResultsEntities={scanResultsEntities}
            aiDiscoveringEntities={aiDiscoveringEntities}
            aiResolvingRelationships={aiResolvingRelationships}
            scanAllRunning={scanAllRunning}
            onDiscoverEntities={handleDiscoverEntitiesWithAI}
            onDiscoverRelationships={handleDiscoverRelationshipsWithAI}
            onScanAll={handleScanAllWithAI}
          />

          {/* Select All / Deselect All for entities selectable for OpenCTI */}
          <ScanResultsSelectionActions
            filteredScanResultsEntities={filteredScanResultsEntities}
            selectedScanItems={selectedScanItems}
            setSelectedScanItems={setSelectedScanItems}
            onImportSelected={handleImportSelectedScanResults}
          />

      {/* Tabs for Entities/Relationships when relationships exist */}
      {resolvedRelationships.length > 0 && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1.5 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{
              minHeight: 36,
              '& .MuiTab-root': {
                minHeight: 36,
                py: 0.5,
                fontSize: '0.8rem',
                textTransform: 'none',
              },
            }}
          >
            <Tab 
              label={`Entities (${filteredScanResultsEntities.length})`} 
              sx={{ flex: 1 }}
            />
            <Tab 
              label={`Relationships (${resolvedRelationships.length})`}
              sx={{ 
                flex: 1,
                color: resolvedRelationships.length > 0 ? aiColors.main : 'inherit',
              }}
            />
          </Tabs>
        </Box>
      )}

      {/* Relationships tab content */}
      {activeTab === 1 && resolvedRelationships.length > 0 && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {resolvedRelationships.map((rel, index) => (
            <ScanResultsRelationshipItem
              key={index}
              relationship={rel}
              index={index}
              mode={mode}
              aiColors={aiColors}
              entities={scanResultsEntities}
              onDelete={(i) => setResolvedRelationships(prev => prev.filter((_, idx) => idx !== i))}
            />
          ))}
        </Box>
      )}

      {/* Entity list */}
      <Box sx={{ flex: 1, overflow: 'auto', display: activeTab === 0 || resolvedRelationships.length === 0 ? 'block' : 'none' }}>
        {filteredScanResultsEntities.length === 0 ? (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: 150,
            color: 'text.secondary',
          }}>
            <SearchOutlined sx={{ fontSize: 40, mb: 1.5, opacity: 0.5 }} />
            <Typography variant="body2">
              {scanResultsEntities.length === 0 
                ? 'No entities detected on this page' 
                : 'No results match your filters'}
            </Typography>
            <Typography variant="caption" sx={{ mt: 0.5, opacity: 0.7 }}>
              {scanResultsEntities.length === 0 
                ? 'Try using AI discovery above' 
                : 'Adjust your search or filters'}
            </Typography>
          </Box>
        ) : (
          filteredScanResultsEntities.map((entity, index) => {
            const entityValue = entity.value || entity.name;
            const isSelectable = isSelectableForOpenCTI(entity);
            const isSelected = isSelectable && selectedScanItems.has(entityValue);
            
            return (
              <ScanResultsEntityItem
                key={entity.id + '-' + index}
                entity={entity}
                index={index}
                mode={mode}
                aiColors={aiColors}
                isSelected={isSelected}
                isSelectable={isSelectable}
                onEntityClick={handleScanResultEntityClick}
                onToggleSelection={(value) => {
                  window.parent.postMessage({ type: 'XTM_TOGGLE_SELECTION', value }, '*');
                  const next = new Set(selectedScanItems);
                  if (next.has(value)) {
                    next.delete(value);
                  } else {
                    next.add(value);
                  }
                  setSelectedScanItems(next);
                }}
              />
            );
          })
        )}
      </Box>
    </Box>
  );
};

export default CommonScanResultsView;

