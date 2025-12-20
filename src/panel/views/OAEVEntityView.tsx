/**
 * OAEVEntityView - Displays entity details for OpenAEV entities
 * 
 * Handles rendering of OpenAEV-specific entities like:
 * - Asset (Endpoint)
 * - AssetGroup
 * - Player/User
 * - Team
 * - Organization
 * - AttackPattern
 * - Finding
 * - Scenario
 * - Exercise
 * - Vulnerability (CVE)
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ChevronRightOutlined,
  ContentCopyOutlined,
  ComputerOutlined,
  LanOutlined,
  PersonOutlined,
  GroupsOutlined,
  MovieFilterOutlined,
  TravelExploreOutlined,
  DomainOutlined,
  BugReportOutlined,
} from '@mui/icons-material';
import { LockPattern, Kayaking } from 'mdi-material-ui';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { hexToRGB } from '../../shared/theme/colors';
import { formatDateTime } from '../../shared/utils/formatters';
import {
  getOAEVEntityName,
  getOAEVEntityId,
  getOAEVEntityUrl,
  getOAEVEntityColor,
} from '../../shared/utils/entity';
import { getPlatformLogoName, getPlatformName } from '../../shared/platform/registry';
import { sectionTitleStyle, useContentTextStyle, useLogoSuffix } from '../hooks/useEntityDisplay';
import { usePlatformNavigation, useBackNavigation } from '../hooks/usePlatformNavigation';
import type { EntityData } from '../types/panel-types';
import type { OAEVEntityViewProps } from '../types/view-props';

export const OAEVEntityView: React.FC<OAEVEntityViewProps> = ({
  mode,
  entity,
  setEntity,
  entityDetailsLoading,
  setEntityDetailsLoading,
  availablePlatforms,
  multiPlatformResults,
  setMultiPlatformResults,
  currentPlatformIndex,
  setCurrentPlatformIndex,
  currentPlatformIndexRef,
  multiPlatformResultsRef,
  setPlatformUrl,
  setSelectedPlatformId,
  entityFromSearchMode,
  setEntityFromSearchMode,
  entityFromScanResults,
  setEntityFromScanResults,
  setPanelMode,
  handleCopyValue,
}) => {
  const logoSuffix = useLogoSuffix(mode);
  const contentTextStyle = useContentTextStyle(mode);

  // Fire-and-forget fetch for entity details (defined early for hook usage)
  const fetchEntityDetailsInBackground = React.useCallback((targetEntity: EntityData, targetPlatformId: string, targetIdx: number) => {
    // Determine the correct platform type based on target entity or platform
    const targetPlatform = availablePlatforms.find(p => p.id === targetPlatformId);
    const platformType = targetEntity.platformType || targetPlatform?.type || 'openaev';
    const isNonDefault = platformType !== 'opencti';
    
    const entityIdToFetch = targetEntity.entityId || targetEntity.id;
    // Remove prefix based on platform type
    const entityTypeToFetch = (targetEntity.entity_type || targetEntity.type || '')
      .replace(/^(oaev|ogrc)-/, '');
    
    if (!entityIdToFetch || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setEntityDetailsLoading(true);
    chrome.runtime.sendMessage({
      type: 'GET_ENTITY_DETAILS',
      payload: { id: entityIdToFetch, entityType: entityTypeToFetch, platformId: targetPlatformId, platformType },
    }, (response) => {
      if (chrome.runtime.lastError) {
        setEntityDetailsLoading(false);
        return;
      }
      if (currentPlatformIndexRef.current !== targetIdx) {
        setEntityDetailsLoading(false);
        return;
      }
      
      if (response?.success && response.data) {
        const fullEntity = {
          ...targetEntity,
          ...response.data,
          entityData: response.data,
          existsInPlatform: true,
          platformId: targetPlatformId,
          platformType: platformType,
          isNonDefaultPlatform: isNonDefault,
        };
        setEntity(fullEntity);
        multiPlatformResultsRef.current = multiPlatformResultsRef.current.map((r, i) =>
          i === targetIdx ? { ...r, entity: fullEntity as EntityData } : r
        );
      }
      setEntityDetailsLoading(false);
    });
  }, [availablePlatforms, currentPlatformIndexRef, multiPlatformResultsRef, setEntity, setEntityDetailsLoading]);

  // Platform navigation using shared hook (must be called unconditionally)
  const {
    handlePreviousPlatform: handlePrevPlatform,
    handleNextPlatform,
    hasMultiplePlatforms,
    currentResult,
    currentPlatform: navCurrentPlatform,
  } = usePlatformNavigation({
    state: {
      multiPlatformResults,
      currentPlatformIndex,
      currentPlatformIndexRef,
      multiPlatformResultsRef,
    },
    setters: {
      setMultiPlatformResults,
      setCurrentPlatformIndex,
      setEntity,
      setSelectedPlatformId,
      setPlatformUrl,
    },
    availablePlatforms,
    fetchEntityDetailsInBackground,
  });

  // Back navigation using shared hook (must be called unconditionally)
  const handleBackToList = useBackNavigation({
    entityFromScanResults,
    setEntityFromScanResults,
    entityFromSearchMode,
    setEntityFromSearchMode,
    setMultiPlatformResults,
    setPanelMode,
  });

  if (!entity) return null;
  
  const entityData = (entity as any).entityData || entity || {};
  const rawType = (entity as any).type || '';
  const oaevType = rawType.replace('oaev-', '');
  const entityPlatformId = (entity as any).platformId || (entity as any).platformId;
  
  // Find the platform
  const platform = entityPlatformId 
    ? availablePlatforms.find(p => p.id === entityPlatformId)
    : availablePlatforms.find(p => p.type === 'openaev');
  const platformUrl = platform?.url || '';
  
  // Color based on entity type
  const color = getOAEVEntityColor(oaevType);
  
  // Get entity properties using shared utilities
  const name = getOAEVEntityName(entityData, oaevType);
  const entityId = getOAEVEntityId(entityData, oaevType);
  const entityUrl = getOAEVEntityUrl(platformUrl, oaevType, entityId);
  const mitreId = entityData.attack_pattern_external_id || '';
  
  // Extract description based on entity type
  const getDescription = (): string => {
    switch (oaevType) {
      case 'Asset': return entityData.endpoint_description || entityData.asset_description || '';
      case 'AssetGroup': return entityData.asset_group_description || '';
      case 'Player':
      case 'User': return entityData.user_organization || entityData.description || '';
      case 'Team': return entityData.team_description || '';
      case 'Organization': return entityData.organization_description || entityData.description || '';
      case 'AttackPattern': return entityData.attack_pattern_description || '';
      case 'Finding': return entityData.finding_description || `Type: ${entityData.finding_type || 'Unknown'}`;
      case 'Scenario': return entityData.scenario_description || entityData.description || '';
      case 'Exercise': return entityData.exercise_description || entityData.description || '';
      case 'Vulnerability': return entityData.vulnerability_description || entityData.description || '';
      default: return entityData.description || '';
    }
  };
  const rawDescription = getDescription();
  // Truncate description to 500 characters
  const description = rawDescription.length > 500 
    ? rawDescription.slice(0, 500) + '...' 
    : rawDescription;
  
  // Get OpenAEV icon based on type
  const getOAEVIcon = () => {
    switch (oaevType) {
      case 'Asset': return <ComputerOutlined sx={{ fontSize: 20, color }} />;
      case 'AssetGroup': return <LanOutlined sx={{ fontSize: 20, color }} />;
      case 'Player':
      case 'User': return <PersonOutlined sx={{ fontSize: 20, color }} />;
      case 'Team': return <GroupsOutlined sx={{ fontSize: 20, color }} />;
      case 'Organization': return <DomainOutlined sx={{ fontSize: 20, color }} />;
      case 'Scenario': return <MovieFilterOutlined sx={{ fontSize: 20, color }} />;
      case 'Exercise': return <Kayaking sx={{ fontSize: 20, color }} />;
      case 'AttackPattern': return <LockPattern sx={{ fontSize: 20, color }} />;
      case 'Finding': return <TravelExploreOutlined sx={{ fontSize: 20, color }} />;
      case 'Vulnerability': return <BugReportOutlined sx={{ fontSize: 20, color }} />;
      default: return <ComputerOutlined sx={{ fontSize: 20, color }} />;
    }
  };

  // Determine display
  const currentPlatformType = currentResult?.entity?.platformType || navCurrentPlatform?.type || 'openaev';
  const platformLogo = getPlatformLogoName(currentPlatformType);

  // Handle back button click
  const handleBackClick = () => {
    if (entityFromSearchMode || entityFromScanResults) {
      handleBackToList();
    } else {
      setPanelMode('empty');
    }
  };

  return (
    <Box sx={{ p: 2, overflow: 'auto' }}>
      {/* Back button - always visible for consistent navigation */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={handleBackClick}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {entityFromScanResults ? 'Back to scan results' : entityFromSearchMode ? 'Back to search' : 'Back to actions'}
        </Button>
      </Box>
      
      {/* Platform indicator bar with navigation */}
      {(availablePlatforms.length > 1 || hasMultiplePlatforms) && (
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 2, 
            p: 1, 
            bgcolor: 'action.hover',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          {hasMultiplePlatforms ? (
            <>
              <IconButton 
                size="small" 
                onClick={handlePrevPlatform}
                disabled={currentPlatformIndex === 0 || entityDetailsLoading}
                sx={{ opacity: currentPlatformIndex === 0 ? 0.3 : 1 }}
              >
                <ChevronLeftOutlined />
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {entityDetailsLoading ? (
                  <CircularProgress size={18} />
                ) : (
                  <img
                    src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                      ? chrome.runtime.getURL(`assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`)
                      : `../assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`
                    }
                    alt={getPlatformName(currentPlatformType)}
                    width={18}
                    height={18}
                  />
                )}
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {navCurrentPlatform?.name || getPlatformName(currentPlatformType)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  ({currentPlatformIndex + 1}/{multiPlatformResults.length})
                </Typography>
              </Box>
              <IconButton 
                size="small" 
                onClick={handleNextPlatform}
                disabled={currentPlatformIndex === multiPlatformResults.length - 1 || entityDetailsLoading}
                sx={{ opacity: currentPlatformIndex === multiPlatformResults.length - 1 ? 0.3 : 1 }}
              >
                <ChevronRightOutlined />
              </IconButton>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'center' }}>
              {entityDetailsLoading ? (
                <CircularProgress size={18} />
              ) : (
                <img
                  src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                    ? chrome.runtime.getURL(`assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`)
                    : `../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`
                  }
                  alt="OpenAEV"
                  width={18}
                  height={18}
                />
              )}
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {platform?.name || 'OpenAEV'}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Type Badge */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          mb: 2,
          borderRadius: 1,
          bgcolor: hexToRGB(color, 0.2),
          border: `2px solid ${color}`,
        }}
      >
        {getOAEVIcon()}
        <Typography variant="body2" sx={{ fontWeight: 700, color, letterSpacing: '0.5px' }}>
          {oaevType.replace(/([A-Z])/g, ' $1').trim()}
        </Typography>
      </Box>

      {/* Name */}
      <Typography variant="h6" sx={{ mb: 1, wordBreak: 'break-word', fontWeight: 600 }}>
        {name}
      </Typography>

      {/* Attack Pattern: MITRE ID */}
      {oaevType === 'AttackPattern' && mitreId && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={sectionTitleStyle}>
            Technique ID
          </Typography>
          <Chip 
            label={mitreId} 
            size="small" 
            sx={{ 
              bgcolor: hexToRGB(color, 0.2), 
              color,
              fontWeight: 600,
              borderRadius: 1,
              fontSize: '0.875rem',
            }} 
          />
        </Box>
      )}

      {/* Entity-specific details */}
      {oaevType === 'Asset' && (
        <>
          {/* Hostname */}
          {(entityData.endpoint_hostname || entityData.asset_hostname) && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Hostname
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                {entityData.endpoint_hostname || entityData.asset_hostname}
              </Typography>
            </Box>
          )}
          
          {/* IPs */}
          {((entityData.endpoint_ips || entityData.asset_ips) && (entityData.endpoint_ips || entityData.asset_ips).length > 0) && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                IP Addresses
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(entityData.endpoint_ips || entityData.asset_ips).map((ip: string, i: number) => (
                  <Chip key={i} label={ip} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1, fontWeight: 500 }} />
                ))}
              </Box>
            </Box>
          )}
          
          {/* Platform */}
          {(entityData.endpoint_platform || entityData.asset_platform) && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Platform
              </Typography>
              <Chip 
                label={entityData.endpoint_platform || entityData.asset_platform} 
                size="small" 
                sx={{ bgcolor: 'action.selected', borderRadius: 1, fontWeight: 500 }}
              />
            </Box>
          )}
          
          {/* Architecture */}
          {entityData.endpoint_arch && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Architecture
              </Typography>
              <Chip label={entityData.endpoint_arch} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1, fontWeight: 500 }} />
            </Box>
          )}
          
          {/* Asset Type */}
          {(entityData.asset_type || entityData.endpoint_type) && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Asset Type
              </Typography>
              <Chip label={entityData.asset_type || entityData.endpoint_type} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1, fontWeight: 500 }} />
            </Box>
          )}
          
          {/* Last Seen */}
          {(entityData.asset_last_seen || entityData.endpoint_last_seen) && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Last Seen
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                {formatDateTime(entityData.asset_last_seen || entityData.endpoint_last_seen)}
              </Typography>
            </Box>
          )}
          
          {/* MACs */}
          {((entityData.endpoint_mac_addresses || entityData.asset_mac_addresses) && (entityData.endpoint_mac_addresses || entityData.asset_mac_addresses).length > 0) && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                MAC Addresses
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(entityData.endpoint_mac_addresses || entityData.asset_mac_addresses).map((mac: string, i: number) => (
                  <Chip key={i} label={mac} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1, fontWeight: 500 }} />
                ))}
              </Box>
            </Box>
          )}
          
          {/* Tags */}
          {((entityData.asset_tags_resolved || entityData.endpoint_tags_resolved || entityData.asset_tags || entityData.endpoint_tags) && 
            (entityData.asset_tags_resolved || entityData.endpoint_tags_resolved || entityData.asset_tags || entityData.endpoint_tags).length > 0) && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: '100%' }}>
                {(entityData.asset_tags_resolved || entityData.endpoint_tags_resolved || entityData.asset_tags || entityData.endpoint_tags).map((tag: string, i: number) => (
                  <Chip 
                    key={i} 
                    label={tag} 
                    size="small" 
                    sx={{ 
                      bgcolor: 'action.selected', 
                      borderRadius: 1,
                      fontWeight: 500,
                      maxWidth: '100%',
                      '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                    }} 
                  />
                ))}
              </Box>
            </Box>
          )}
        </>
      )}

      {/* AssetGroup specific */}
      {oaevType === 'AssetGroup' && (
        <>
          {(entityData.asset_group_assets?.length > 0 || entityData.assets?.length > 0) && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Assets Count
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                {entityData.asset_group_assets?.length || entityData.assets?.length || 0} assets
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Player/User specific */}
      {(oaevType === 'Player' || oaevType === 'User') && (
        <>
          {entityData.user_email && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Email
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                {entityData.user_email}
              </Typography>
            </Box>
          )}
          {entityData.user_phone && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Phone
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                {entityData.user_phone}
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Team specific */}
      {oaevType === 'Team' && (
        <>
          {entityData.team_users?.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Members
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                {entityData.team_users.length} members
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Finding specific */}
      {oaevType === 'Finding' && (
        <>
          {entityData.finding_type && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Finding Type
              </Typography>
              <Chip label={entityData.finding_type} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1, fontWeight: 500 }} />
            </Box>
          )}
          {entityData.finding_created_at && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Found At
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                {formatDateTime(entityData.finding_created_at)}
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Vulnerability (CVE) specific */}
      {oaevType === 'Vulnerability' && (
        <>
          {/* CVE ID */}
          {entityData.vulnerability_external_id && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                CVE ID
              </Typography>
              <Chip 
                label={entityData.vulnerability_external_id} 
                size="small" 
                sx={{ 
                  bgcolor: hexToRGB(color, 0.2), 
                  color,
                  fontWeight: 600,
                  borderRadius: 1,
                  fontSize: '0.875rem',
                }} 
              />
            </Box>
          )}
          
          {/* CVSS Score */}
          {entityData.vulnerability_cvss_v31 != null && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                CVSS v3.1 Score
              </Typography>
              <Chip 
                label={entityData.vulnerability_cvss_v31.toFixed(1)} 
                size="small" 
                sx={{ 
                  bgcolor: entityData.vulnerability_cvss_v31 >= 9 ? '#d32f2f' :
                           entityData.vulnerability_cvss_v31 >= 7 ? '#f57c00' :
                           entityData.vulnerability_cvss_v31 >= 4 ? '#fbc02d' : '#388e3c',
                  color: '#fff',
                  fontWeight: 700,
                  borderRadius: 1,
                  fontSize: '0.875rem',
                }} 
              />
            </Box>
          )}
          
          {/* Vulnerability Name (CISA) */}
          {entityData.vulnerability_cisa_vulnerability_name && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Vulnerability Name
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                {entityData.vulnerability_cisa_vulnerability_name}
              </Typography>
            </Box>
          )}
          
          {/* Status */}
          {entityData.vulnerability_vuln_status && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Status
              </Typography>
              <Chip 
                label={entityData.vulnerability_vuln_status} 
                size="small" 
                sx={{ bgcolor: 'action.selected', borderRadius: 1, fontWeight: 500 }} 
              />
            </Box>
          )}
          
          {/* Published Date */}
          {entityData.vulnerability_published && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Published Date
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                {formatDateTime(entityData.vulnerability_published)}
              </Typography>
            </Box>
          )}
          
          {/* Remediation */}
          {entityData.vulnerability_remediation && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Remediation
              </Typography>
              <Typography variant="body2" sx={{ ...contentTextStyle }}>
                {entityData.vulnerability_remediation}
              </Typography>
            </Box>
          )}
          
          {/* Reference URLs */}
          {entityData.vulnerability_reference_urls && entityData.vulnerability_reference_urls.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                References
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {entityData.vulnerability_reference_urls.slice(0, 5).map((url: string, i: number) => (
                  <Typography 
                    key={i} 
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body2" 
                    sx={{ 
                      color: 'primary.main',
                      textDecoration: 'none',
                      wordBreak: 'break-all',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {url}
                  </Typography>
                ))}
                {entityData.vulnerability_reference_urls.length > 5 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ...and {entityData.vulnerability_reference_urls.length - 5} more
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </>
      )}

      {/* Scenario/Exercise specific */}
      {(oaevType === 'Scenario' || oaevType === 'Exercise') && (
        <>
          {entityData.scenario_category && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Category
              </Typography>
              <Chip label={entityData.scenario_category} size="small" sx={{ bgcolor: 'action.selected', borderRadius: 1, fontWeight: 500 }} />
            </Box>
          )}
        </>
      )}

      {/* Description */}
      {description && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={sectionTitleStyle}>
            Description
          </Typography>
          <Box sx={{ 
            ...contentTextStyle, 
            '& p': { my: 0.5 }, 
            '& ul, & ol': { pl: 2, my: 0.5 },
            '& a': { color: 'primary.main' },
          }}>
            <Markdown remarkPlugins={[remarkGfm]}>
              {description}
            </Markdown>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {entityUrl && (
          <Button
            variant="contained"
            size="small"
            startIcon={
              <img 
                src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                  ? chrome.runtime.getURL(`assets/logos/logo_openaev_${mode === 'dark' ? 'light' : 'dark'}-theme_embleme_square.svg`)
                  : `../assets/logos/logo_openaev_${mode === 'dark' ? 'light' : 'dark'}-theme_embleme_square.svg`
                } 
                alt="" 
                style={{ width: 18, height: 18 }} 
              />
            }
            onClick={() => window.open(entityUrl, '_blank')}
            fullWidth
          >
            Open in OpenAEV
          </Button>
        )}
        {name && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyOutlined />}
            onClick={() => handleCopyValue(name)}
          >
            Copy
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default OAEVEntityView;
