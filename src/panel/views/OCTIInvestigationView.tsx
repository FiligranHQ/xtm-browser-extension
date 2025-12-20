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
} from '@mui/material';
import {
  TravelExploreOutlined,
  SearchOutlined,
  ChevronLeftOutlined,
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

      {/* Show selected platform only if multiple OpenCTI platforms */}
      {openctiPlatforms.length > 1 && investigationPlatform && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Found {investigationEntities.length} entities
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={selectAllInvestigationEntities}>Select All</Button>
              <Button size="small" onClick={clearInvestigationSelection}>Clear</Button>
            </Box>
          </Box>

          {/* Type filter */}
          {investigationEntityTypes.length > 1 && (
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth size="small">
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
            </Box>
          )}

          <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
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

