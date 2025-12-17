/**
 * OCTIEntityView - Displays entity details for OpenCTI entities
 * 
 * Handles rendering of both entities and observables with proper styling,
 * platform navigation for multi-platform results, and action buttons.
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Paper,
  Divider,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ChevronRightOutlined,
  OpenInNewOutlined,
  ContentCopyOutlined,
  SecurityOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  inferPlatformTypeFromEntityType, 
  getEntityDetailsMessageType,
  getPlatformLogoName,
  getPlatformName,
} from '../../shared/platform/registry';

import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import { formatDate } from '../../shared/utils/formatters';
import { parsePrefixedType } from '../../shared/platform';
import { getCvssChipStyle, getSeverityColor, getMarkingColor } from '../utils';
import { sectionTitleStyle, useContentTextStyle, useLogoSuffix } from '../hooks';
import type { EntityData } from '../types';
import type { OCTIEntityViewProps } from '../types/view-props';

export const OCTIEntityView: React.FC<OCTIEntityViewProps> = ({
  mode,
  entity,
  setEntity,
  entityContainers,
  loadingContainers,
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
  handleOpenInPlatform,
}) => {
  const logoSuffix = useLogoSuffix(mode);
  const contentTextStyle = useContentTextStyle(mode);

  if (!entity) {
    return null;
  }

  // Check if this is a non-default platform entity (any platform other than OpenCTI)
  const entityType = (entity as any).type || '';
  const isNonDefaultPlatformEntity = (entity as any)._isNonDefaultPlatform || 
    (entity as any)._platformType !== 'opencti' ||
    parsePrefixedType(entityType) !== null;
  
  // If non-default platform entity, this component shouldn't render it
  // (App.tsx handles routing to OAEVEntityView)
  if (isNonDefaultPlatformEntity) {
    return null;
  }
  
  // Entity might be a DetectedSDO/DetectedObservable with entityData, or direct entity data
  const entityData = (entity as any).entityData || entity || {};
  const entityId = (entity as any).entityId || entityData?.id || entity?.id;
  const entityPlatformId = (entity as any)._platformId || (entity as any).platformId;
  
  const type = entityData.entity_type || entity.type || 'unknown';
  const color = itemColor(type, mode === 'dark');
  const name = entityData.representative?.main || entityData.name || entity.value || entity.name || 'Unknown';
  const description = entityData.description || entity.description;
  const aliases = entityData.aliases || entity.aliases;
  
  // Attack Pattern specific: x_mitre_id
  const xMitreId = entityData.x_mitre_id || entity.x_mitre_id;
  const isAttackPattern = type.toLowerCase() === 'attack-pattern';
  const objectLabel = entityData.objectLabel || entity.objectLabel;
  const objectMarking = entityData.objectMarking || entity.objectMarking;
  const created = entityData.created || entity.created;
  const modified = entityData.modified || entity.modified;
  
  // Author and creators
  const author = entityData.createdBy || entity.createdBy;
  const creators = entityData.creators || entity.creators;
  
  // Get current platform info
  const currentPlatform = entityPlatformId 
    ? availablePlatforms.find(p => p.id === entityPlatformId)
    : availablePlatforms[0];
  const hasMultiplePlatforms = multiPlatformResults.length > 1;
  
  // Determine if this is an observable or SDO
  const observableTypes = ['IPv4-Addr', 'IPv6-Addr', 'Domain-Name', 'Hostname', 'Url', 'Email-Addr', 'Mac-Addr', 'StixFile', 'Artifact', 'Cryptocurrency-Wallet', 'User-Agent', 'Phone-Number', 'Bank-Account'];
  const isObservable = observableTypes.some(t => type.toLowerCase().includes(t.toLowerCase().replace(/-/g, ''))) || 
                       type.includes('Addr') || type.includes('Observable');
  const isIndicator = type.toLowerCase() === 'indicator';
  
  // Confidence is for SDOs (not observables or indicators), Score is for observables and indicators
  const confidence = (!isObservable && !isIndicator) ? (entityData.confidence ?? entity.confidence) : undefined;
  const score = (isObservable || isIndicator) ? (entityData.x_opencti_score ?? entity.x_opencti_score) : undefined;
  
  // CVSS fields for vulnerabilities
  const cvssScore = entityData.x_opencti_cvss_base_score;
  const cvssSeverity = entityData.x_opencti_cvss_base_severity;
  const cvssAttackVector = entityData.x_opencti_cvss_attack_vector;
  const cisaKev = entityData.x_opencti_cisa_kev;
  const epssScore = entityData.x_opencti_epss_score;
  const epssPercentile = entityData.x_opencti_epss_percentile;
  const isVulnerability = type.toLowerCase() === 'vulnerability';

  // Helper to check if entity needs full data fetched
  const needsEntityFetch = (entityObj: EntityData | undefined): boolean => {
    if (!entityObj) return true;
    const platformType = entityObj._platformType || 'opencti';
     
    const ed = (entityObj.entityData || entityObj) as any;
    if (platformType === 'openaev') {
      return !(ed.finding_type || ed.finding_created_at || ed.endpoint_name || 
               ed.asset_group_name || ed.team_name || ed.attack_pattern_name || 
               ed.attack_pattern_description || ed.scenario_name || ed.exercise_name || 
               ed.user_email || ed.asset_description);
    }
    return !(entityObj.description || ed.description || entityObj.objectLabel || ed.objectLabel);
  };
  
  // Fire-and-forget fetch for entity details
  const fetchEntityDetailsInBackground = (targetEntity: EntityData, targetPlatformId: string, targetIdx: number) => {
    const platformType = targetEntity._platformType || inferPlatformTypeFromEntityType(targetEntity.type);
    const entityIdToFetch = targetEntity.entityId || targetEntity.id;
    const entityTypeToFetch = (targetEntity.entity_type || targetEntity.type || '').replace(/^(oaev|ogrc)-/, '');
    
    if (!entityIdToFetch || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    const messageType = getEntityDetailsMessageType(platformType);
    chrome.runtime.sendMessage({
      type: messageType,
      payload: { id: entityIdToFetch, entityId: entityIdToFetch, entityType: entityTypeToFetch, platformId: targetPlatformId },
    }, (response) => {
      if (chrome.runtime.lastError) return;
      if (currentPlatformIndexRef.current !== targetIdx) return;
      
      if (response?.success && response.data) {
        const fullEntity = {
          ...targetEntity,
          ...response.data,
          entityData: response.data,
          existsInPlatform: true,
          _platformId: targetPlatformId,
          _platformType: platformType,
          _isNonDefaultPlatform: platformType !== 'opencti',
        };
        setEntity(fullEntity);
        multiPlatformResultsRef.current = multiPlatformResultsRef.current.map((r, i) =>
          i === targetIdx ? { ...r, entity: fullEntity as EntityData } : r
        );
      }
    });
  };

  // Platform navigation handlers
  const handlePrevPlatform = () => {
    const idx = currentPlatformIndexRef.current;
    const results = multiPlatformResultsRef.current;
    if (idx > 0 && results.length > 1) {
      const newIdx = idx - 1;
      const target = results[newIdx];
      const platform = availablePlatforms.find(p => p.id === target.platformId);
      currentPlatformIndexRef.current = newIdx;
      setCurrentPlatformIndex(newIdx);
      setEntity(target.entity);
      setSelectedPlatformId(target.platformId);
      if (platform) setPlatformUrl(platform.url);
      if (needsEntityFetch(target.entity)) {
        fetchEntityDetailsInBackground(target.entity, target.platformId, newIdx);
      }
    }
  };

  const handleNextPlatform = () => {
    const idx = currentPlatformIndexRef.current;
    const results = multiPlatformResultsRef.current;
    if (idx < results.length - 1) {
      const newIdx = idx + 1;
      const target = results[newIdx];
      const platform = availablePlatforms.find(p => p.id === target.platformId);
      currentPlatformIndexRef.current = newIdx;
      setCurrentPlatformIndex(newIdx);
      setEntity(target.entity);
      setSelectedPlatformId(target.platformId);
      if (platform) setPlatformUrl(platform.url);
      if (needsEntityFetch(target.entity)) {
        fetchEntityDetailsInBackground(target.entity, target.platformId, newIdx);
      }
    }
  };

  // Handle back to search/scan results
  const handleBackToList = () => {
    if (entityFromScanResults) {
      setEntityFromScanResults(false);
      setMultiPlatformResults([]);
      setPanelMode('scan-results');
    } else if (entityFromSearchMode) {
      setMultiPlatformResults([]);
      setPanelMode(entityFromSearchMode);
      setEntityFromSearchMode(null);
    }
  };

  // Determine current platform type for logo display
  const currentPlatformType = currentPlatform?.type || 'opencti';
  const platformLogo = getPlatformLogoName(currentPlatformType);
  const platformAlt = getPlatformName(currentPlatformType);

  return (
    <Box sx={{ p: 2, overflow: 'auto' }}>
      {/* Back to search/scan results button */}
      {(entityFromSearchMode || entityFromScanResults) && (
        <Box sx={{ mb: 1.5 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={handleBackToList}
            sx={{ 
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            {entityFromScanResults ? 'Back to scan results' : 'Back to search'}
          </Button>
        </Box>
      )}
      
      {/* Platform indicator bar */}
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
                disabled={currentPlatformIndex === 0}
                sx={{ opacity: currentPlatformIndex === 0 ? 0.3 : 1 }}
              >
                <ChevronLeftOutlined />
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <img
                  src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                    ? chrome.runtime.getURL(`assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`)
                    : `../assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`
                  }
                  alt={platformAlt}
                  width={18}
                  height={18}
                />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {currentPlatform?.name || platformAlt}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  ({currentPlatformIndex + 1}/{multiPlatformResults.length})
                </Typography>
              </Box>
              <IconButton 
                size="small" 
                onClick={handleNextPlatform} 
                disabled={currentPlatformIndex === multiPlatformResults.length - 1}
                sx={{ opacity: currentPlatformIndex === multiPlatformResults.length - 1 ? 0.3 : 1 }}
              >
                <ChevronRightOutlined />
              </IconButton>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'center' }}>
              <img
                src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                  ? chrome.runtime.getURL(`assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`)
                  : `../assets/logos/logo_${platformLogo}_${logoSuffix}_embleme_square.svg`
                }
                alt={platformAlt}
                width={18}
                height={18}
              />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {currentPlatform?.name || platformAlt}
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
        <ItemIcon type={type} size="small" color={color} />
        <Typography variant="body2" sx={{ fontWeight: 700, color, textTransform: 'capitalize', letterSpacing: '0.5px' }}>
          {type.replace(/-/g, ' ')}
        </Typography>
      </Box>

      {/* Name */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ wordBreak: 'break-word', fontWeight: 600 }}>
          {name}
        </Typography>
        {(entity as any)?._draftId && (
          <Chip 
            label="Draft" 
            size="small" 
            sx={{ 
              bgcolor: '#ff9800', 
              color: '#000', 
              fontWeight: 700,
              fontSize: '0.7rem',
              height: 20,
            }} 
          />
        )}
      </Box>

      {/* Attack Pattern: MITRE ID */}
      {isAttackPattern && xMitreId && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={sectionTitleStyle}>
            Technique ID
          </Typography>
          <Chip 
            label={xMitreId} 
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

      {/* Vulnerability: CVSS Scores */}
      {isVulnerability && (cvssScore != null || cvssSeverity) && (
        <Box sx={{ mb: 2.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {cvssScore != null && (
            <Chip
              icon={<SecurityOutlined sx={{ fontSize: 16 }} />}
              label={`CVSS ${cvssScore.toFixed(1)}`}
              sx={getCvssChipStyle(cvssScore)}
            />
          )}
          {cvssSeverity && (
            <Chip
              label={cvssSeverity.toUpperCase()}
              sx={{
                fontWeight: 700,
                fontSize: 12,
                height: 34,
                ...getSeverityColor(cvssSeverity),
              }}
            />
          )}
          {cisaKev && (
            <Chip
              icon={<WarningAmberOutlined sx={{ fontSize: 16 }} />}
              label="CISA KEV"
              sx={{
                fontWeight: 700,
                fontSize: 12,
                height: 34,
                bgcolor: '#d32f2f',
                color: '#ffffff',
                '& .MuiChip-icon': { color: '#ffffff' },
              }}
            />
          )}
        </Box>
      )}

      {/* EPSS Score for Vulnerabilities */}
      {isVulnerability && epssScore != null && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={sectionTitleStyle}>
            EPSS Score
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {(epssScore * 100).toFixed(2)}%
            </Typography>
            {epssPercentile != null && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                (Percentile: {(epssPercentile * 100).toFixed(0)}%)
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* CVSS Attack Vector */}
      {isVulnerability && cvssAttackVector && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={sectionTitleStyle}>
            Attack Vector
          </Typography>
          <Chip label={cvssAttackVector} size="small" sx={{ borderRadius: 1 }} />
        </Box>
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

      {/* Aliases */}
      {aliases && aliases.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={sectionTitleStyle}>
            Aliases
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {aliases.slice(0, 8).map((alias: string, i: number) => (
              <Chip 
                key={i} 
                label={alias} 
                size="small" 
                sx={{ borderRadius: 1, bgcolor: 'action.selected', fontWeight: 500 }} 
              />
            ))}
            {aliases.length > 8 && (
              <Chip 
                label={`+${aliases.length - 8}`} 
                size="small" 
                sx={{ bgcolor: 'action.hover', fontWeight: 600 }}
              />
            )}
          </Box>
        </Box>
      )}

      {/* Author and Creator Section */}
      {(author || (creators && creators.length > 0)) && (
        <Box sx={{ mb: 2.5 }}>
          {author && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Author
              </Typography>
              {author.id && currentPlatform?.url ? (
                <Typography 
                  variant="body2" 
                  onClick={() => handleOpenInPlatform(author.id)}
                  sx={{ 
                    fontWeight: 500, 
                    ...contentTextStyle,
                    color: 'primary.main',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {author.name}
                  <OpenInNewOutlined sx={{ fontSize: 14 }} />
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                  {author.name}
                </Typography>
              )}
            </Box>
          )}
          {creators && creators.length > 0 && (
            <Box>
              <Typography variant="caption" sx={sectionTitleStyle}>
                Creator{creators.length > 1 ? 's' : ''}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {creators.map((c: { id: string; name: string }, idx: number) => (
                  <Typography key={c.id || idx} variant="body2" sx={{ fontWeight: 500, ...contentTextStyle }}>
                    {c.name}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Confidence - only for SDOs */}
      {confidence !== undefined && confidence !== null && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Confidence Level
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, ...contentTextStyle }}>
              {confidence}/100
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={confidence || 0}
            sx={{
              height: 10,
              borderRadius: 1,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 1,
                bgcolor: confidence >= 70 ? '#4caf50' :
                  confidence >= 40 ? '#ff9800' : '#f44336',
              },
            }}
          />
        </Box>
      )}

      {/* Score - for observables and indicators */}
      {score !== undefined && score !== null && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant="caption" sx={sectionTitleStyle}>
              Score
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, ...contentTextStyle }}>
              {score}/100
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={score || 0}
            sx={{
              height: 10,
              borderRadius: 1,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 1,
                bgcolor: score >= 70 ? '#f44336' :
                  score >= 40 ? '#ff9800' : '#4caf50',
              },
            }}
          />
        </Box>
      )}

      {/* Labels */}
      {objectLabel && objectLabel.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={sectionTitleStyle}>
            Labels
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: '100%' }}>
            {objectLabel.map((label: any, i: number) => (
              <Chip
                key={i}
                label={label.value}
                size="small"
                variant="outlined"
                sx={{ 
                  color: label.color,
                  borderColor: label.color,
                  bgcolor: hexToRGB(label.color, 0.08),
                  fontWeight: 500,
                  borderRadius: 1,
                  maxWidth: 150,
                  '& .MuiChip-label': { 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Markings */}
      {objectMarking && objectMarking.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={sectionTitleStyle}>
            Marking Definitions
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: '100%' }}>
            {objectMarking.map((marking: any, i: number) => {
              const markingColor = marking.x_opencti_color || getMarkingColor(marking.definition, mode);
              return (
                <Chip 
                  key={i} 
                  label={marking.definition} 
                  size="small" 
                  sx={{
                    borderRadius: 1,
                    fontWeight: 600,
                    fontSize: 12,
                    height: 25,
                    bgcolor: hexToRGB(markingColor, 0.2),
                    color: mode === 'dark' ? '#ffffff' : 'text.primary',
                    border: `2px solid ${markingColor}`,
                    maxWidth: 150,
                    '& .MuiChip-label': { 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* Dates Section */}
      {(created || modified || entityData.created_at || entityData.updated_at || entityData.first_seen || entityData.last_seen) && (
        <Paper 
          elevation={0} 
          sx={{ 
            mb: 2.5, 
            p: 2, 
            borderRadius: 1, 
            bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" sx={sectionTitleStyle}>
            Dates
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            {created && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                  Created (STIX)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                  {formatDate(created)}
                </Typography>
              </Box>
            )}
            {modified && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                  Modified (STIX)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                  {formatDate(modified)}
                </Typography>
              </Box>
            )}
            {entityData.created_at && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                  Created (Platform)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                  {formatDate(entityData.created_at)}
                </Typography>
              </Box>
            )}
            {entityData.updated_at && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                  Updated (Platform)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                  {formatDate(entityData.updated_at)}
                </Typography>
              </Box>
            )}
            {entityData.first_seen && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                  First Seen
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                  {formatDate(entityData.first_seen)}
                </Typography>
              </Box>
            )}
            {entityData.last_seen && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
                  Last Seen
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, ...contentTextStyle }}>
                  {formatDate(entityData.last_seen)}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Containers Section */}
      {entityContainers.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={sectionTitleStyle}>
            Latest Containers ({entityContainers.length})
          </Typography>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            {entityContainers.map((container, idx) => {
              const containerColor = itemColor(container.entity_type, mode === 'dark');
              return (
                <Box
                  key={container.id}
                  onClick={() => handleOpenInPlatform(container.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    cursor: 'pointer',
                    borderBottom: idx < entityContainers.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                    transition: 'background-color 0.2s',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ItemIcon type={container.entity_type} size="small" color={containerColor} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 500, 
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        ...contentTextStyle,
                      }}
                    >
                      {container.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {container.createdBy?.name && (
                        <>
                          <span>{container.createdBy.name}</span>
                          <span>•</span>
                        </>
                      )}
                      {container.created && (
                        <span>{formatDate(container.created)}</span>
                      )}
                    </Typography>
                  </Box>
                  <OpenInNewOutlined fontSize="small" sx={{ color: 'text.secondary', opacity: 0.5 }} />
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
      {loadingContainers && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Loading containers...
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {entityId && currentPlatform?.url && (
          <Button
            variant="contained"
            size="small"
            startIcon={
              <img 
                src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
                  ? chrome.runtime.getURL(`assets/logos/logo_opencti_${mode === 'dark' ? 'light' : 'dark'}-theme_embleme_square.svg`)
                  : `../assets/logos/logo_opencti_${mode === 'dark' ? 'light' : 'dark'}-theme_embleme_square.svg`
                } 
                alt="" 
                style={{ width: 18, height: 18 }} 
              />
            }
            onClick={() => {
              const url = (entity as any)?._draftId 
                ? `${currentPlatform.url}/dashboard/data/import/draft/${(entity as any)?._draftId}`
                : `${currentPlatform.url}/dashboard/id/${entityId}`;
              window.open(url, '_blank');
            }}
            fullWidth
          >
            {(entity as any)?._draftId ? 'Open Draft in OpenCTI' : 'Open in OpenCTI'}
          </Button>
        )}
        {(entity.value || name) && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyOutlined />}
            onClick={() => handleCopyValue(entity.value || name || '')}
          >
            Copy
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default OCTIEntityView;
