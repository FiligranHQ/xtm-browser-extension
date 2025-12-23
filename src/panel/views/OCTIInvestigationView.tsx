/**
 * Investigation View Component
 *
 * Investigation mode for scanning pages and creating workbenches.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  TravelExploreOutlined,
  SearchOutlined,
  ChevronLeftOutlined,
  CheckBoxOutlined,
  CheckBoxOutlineBlankOutlined,
  LayersClearOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import { formatEntityTypeForDisplay } from '../../shared/platform/registry';
import type { PlatformInfo, InvestigationEntity } from '../types/panel-types';
import { useTheme } from '@mui/material/styles';

export interface InvestigationViewProps {
  mode: 'dark' | 'light';
  openctiPlatforms: PlatformInfo[];
  availablePlatforms: PlatformInfo[];
  investigationPlatformId: string | null;
  investigationPlatformSelected: boolean;
  setInvestigationPlatformSelected: (selected: boolean) => void;
  investigationEntities: InvestigationEntity[];
  setInvestigationEntities: (entities: InvestigationEntity[]) => void;
  investigationScanning: boolean;
  investigationTypeFilter: string;
  setInvestigationTypeFilter: (filter: string) => void;
  investigationSearchQuery: string;
  setInvestigationSearchQuery: (query: string) => void;
  investigationEntityTypes: string[];
  filteredInvestigationEntities: InvestigationEntity[];
  selectedInvestigationCount: number;
  submitting: boolean;
  resetInvestigation: () => void;
  handleSelectInvestigationPlatform: (platformId: string) => void;
  handleInvestigationScan: () => void;
  toggleInvestigationEntity: (id: string) => void;
  selectAllInvestigationEntities: () => void;
  clearInvestigationSelection: () => void;
  handleCreateWorkbench: () => void;
}

export const OCTIInvestigationView: React.FC<InvestigationViewProps> = ({
  mode,
  openctiPlatforms,
  availablePlatforms,
  investigationPlatformId,
  investigationPlatformSelected,
  setInvestigationPlatformSelected,
  investigationEntities,
  setInvestigationEntities,
  investigationScanning,
  investigationTypeFilter,
  setInvestigationTypeFilter,
  investigationSearchQuery,
  setInvestigationSearchQuery,
  investigationEntityTypes,
  filteredInvestigationEntities,
  selectedInvestigationCount,
  submitting,
  resetInvestigation,
  handleSelectInvestigationPlatform,
  handleInvestigationScan,
  toggleInvestigationEntity,
  selectAllInvestigationEntities,
  clearInvestigationSelection,
  handleCreateWorkbench,
}) => {
  const theme = useTheme();
  const investigationPlatform = availablePlatforms.find(p => p.id === investigationPlatformId);

  // Step 1: If multiple OpenCTI platforms and none selected, show platform selection
  // Investigation is OpenCTI-only - filter out OpenAEV platforms
  if (openctiPlatforms.length > 1 && !investigationPlatformSelected) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Back to actions button */}
        <Box sx={{ mb: 1.5 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={resetInvestigation}
            sx={{ 
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to actions
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TravelExploreOutlined sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Investigation Mode</Typography>
        </Box>

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Select the OpenCTI platform to scan for existing entities:
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {openctiPlatforms.map((platform) => (
            <Paper
              key={platform.id}
              onClick={() => handleSelectInvestigationPlatform(platform.id)}
              elevation={0}
              sx={{
                p: 2,
                cursor: 'pointer',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <img
                src={typeof chrome !== 'undefined' && chrome.runtime?.getURL
                  ? chrome.runtime.getURL(`assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`)
                  : `../assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`
                }
                alt="OpenCTI"
                style={{ width: 32, height: 32 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {platform.name}
                  </Typography>
                  {platform.isEnterprise !== undefined && (
                    <Box
                      sx={{
                        px: 0.5,
                        py: 0.1,
                        borderRadius: 0.5,
                        fontSize: '9px',
                        fontWeight: 700,
                        lineHeight: 1.3,
                        bgcolor: platform.isEnterprise ? '#7b1fa2' : '#616161',
                        color: '#fff',
                      }}
                    >
                      {platform.isEnterprise ? 'EE' : 'CE'}
                    </Box>
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                  {platform.url} {platform.version ? `• v${platform.version}` : ''}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>
    );
  }

  // Step 2: Show scanning / results view
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Back to actions button */}
      <Box sx={{ mb: 1.5, flexShrink: 0 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={resetInvestigation}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back to actions
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
        <TravelExploreOutlined sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Investigation Mode</Typography>
        {investigationEntities.length > 0 && (
          <Tooltip title="Clear all results and highlights" placement="top">
            <Button
              size="small"
              variant="outlined"
              startIcon={<LayersClearOutlined sx={{ fontSize: '1rem' }} />}
              onClick={() => {
                // Clear highlights
                chrome.tabs?.query({ active: true, currentWindow: true }).then(([tab]) => {
                  if (tab?.id) {
                    chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' }).catch(() => {});
                  }
                }).catch(() => {});
                // Clear results
                setInvestigationEntities([]);
                setInvestigationTypeFilter('all');
                setInvestigationSearchQuery('');
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
        )}
      </Box>

      {/* Show selected platform only if multiple OpenCTI platforms */}
      {openctiPlatforms.length > 1 && investigationPlatform && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1, flexShrink: 0 }}>
          <img
            src={typeof chrome !== 'undefined' && chrome.runtime?.getURL
              ? chrome.runtime.getURL(`assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`)
              : `../assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`
            }
            alt="OpenCTI"
            style={{ width: 20, height: 20 }}
          />
          <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
            {investigationPlatform.name}
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setInvestigationPlatformSelected(false);
              setInvestigationEntities([]);
              // Clear highlights
              chrome.tabs?.query({ active: true, currentWindow: true }).then(([tab]) => {
                if (tab?.id) {
                  chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' });
                }
              });
            }}
          >
            Change
          </Button>
        </Box>
      )}

      {investigationScanning ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Scanning page for existing entities...
          </Typography>
        </Box>
      ) : investigationEntities.length === 0 ? (
        <>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            No entities found in {investigationPlatform?.name || 'OpenCTI'} on this page.
          </Typography>

          <Button
            variant="outlined"
            onClick={() => handleInvestigationScan()}
            startIcon={<SearchOutlined />}
            fullWidth
          >
            Rescan Page
          </Button>
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexShrink: 0 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Found {investigationEntities.length} entities
            </Typography>
          </Box>

          {/* Search and Type filter - 50/50 layout like scan results */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'flex-end', flexShrink: 0 }}>
            {/* Search field */}
            <TextField
              size="small"
              placeholder="Search findings..."
              value={investigationSearchQuery}
              onChange={(e) => setInvestigationSearchQuery(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            {/* Type filter */}
            {investigationEntityTypes.length > 1 && (
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel id="investigation-type-filter-label">Filter by type</InputLabel>
                <Select
                  labelId="investigation-type-filter-label"
                  value={investigationTypeFilter}
                  label="Filter by type"
                  onChange={(e) => setInvestigationTypeFilter(e.target.value)}
                >
                  <MenuItem value="all">
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>All types</span>
                      <Chip label={investigationEntities.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Box>
                  </MenuItem>
                  {investigationEntityTypes.map(type => (
                    <MenuItem key={type} value={type}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>{formatEntityTypeForDisplay(type)}</span>
                        <Chip label={investigationEntities.filter(e => e.type === type).length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>

          {/* Select All / Clear - same styling as scan results */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1, flexShrink: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1, minWidth: 0 }}>
              {selectedInvestigationCount > 0
                ? `${selectedInvestigationCount} selected`
                : `${filteredInvestigationEntities.length} available`
              }
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
              <Button
                size="small"
                variant="outlined"
                disabled={filteredInvestigationEntities.length === 0}
                onClick={selectedInvestigationCount === investigationEntities.length && investigationEntities.length > 0 ? clearInvestigationSelection : selectAllInvestigationEntities}
                startIcon={selectedInvestigationCount === investigationEntities.length && investigationEntities.length > 0 ? <CheckBoxOutlined /> : <CheckBoxOutlineBlankOutlined />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  minWidth: 'auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedInvestigationCount === investigationEntities.length && investigationEntities.length > 0 ? 'Deselect all' : 'Select all'}
              </Button>
            </Box>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', mb: 2, minHeight: 0 }}>
            {filteredInvestigationEntities.map((entity) => {
              const entityColor = itemColor(entity.type, mode === 'dark');
              return (
                <Paper
                  key={entity.id}
                  elevation={0}
                  onClick={() => toggleInvestigationEntity(entity.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    mb: 1,
                    bgcolor: entity.selected ? hexToRGB(theme.palette.primary.main, 0.1) : 'background.paper',
                    border: 1,
                    borderColor: entity.selected ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <Checkbox
                    checked={entity.selected}
                    size="small"
                    sx={{ p: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleInvestigationEntity(entity.id)}
                  />
                  <ItemIcon type={entity.type} size="small" color={entityColor} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                      {entity.name || entity.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {entity.type.replace(/-/g, ' ')}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>

          {selectedInvestigationCount > 0 && (
            <Paper
              elevation={3}
              sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                flexShrink: 0,
              }}
            >
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600 }}>
                {selectedInvestigationCount} entit{selectedInvestigationCount === 1 ? 'y' : 'ies'} selected
              </Typography>
              <Button
                variant="contained"
                onClick={handleCreateWorkbench}
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <TravelExploreOutlined />}
                fullWidth
              >
                {submitting ? 'Creating...' : 'Start Investigation'}
              </Button>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default OCTIInvestigationView;

