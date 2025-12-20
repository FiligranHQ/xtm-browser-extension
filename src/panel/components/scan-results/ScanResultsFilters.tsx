/**
 * Scan Results Filters Component
 * 
 * Renders filter controls including stats boxes, search, and type filter.
 */

import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Chip,
  Divider,
} from '@mui/material';
import {
  SearchOutlined,
} from '@mui/icons-material';
import type { ScanResultEntity } from '../../../shared/types/scan';
import { formatEntityTypeForDisplay } from '../../../shared/platform/registry';

type FoundFilterType = 'all' | 'found' | 'not-found' | 'ai-discovered';

interface ScanResultsFiltersProps {
  scanResultsEntities: ScanResultEntity[];
  scanResultsTypeFilter: string;
  setScanResultsTypeFilter: (filter: string) => void;
  scanResultsFoundFilter: FoundFilterType;
  setScanResultsFoundFilter: (filter: FoundFilterType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  scanResultsFoundCount: number;
  scanResultsNotFoundCount: number;
  scanResultsAICount: number;
  aiColors: { main: string; dark: string; light: string };
}

export const ScanResultsFilters: React.FC<ScanResultsFiltersProps> = ({
  scanResultsEntities,
  scanResultsTypeFilter,
  setScanResultsTypeFilter,
  scanResultsFoundFilter,
  setScanResultsFoundFilter,
  searchQuery,
  setSearchQuery,
  scanResultsFoundCount,
  scanResultsNotFoundCount,
  scanResultsAICount,
  aiColors,
}) => {
  // Get unique entity types for filter
  const scanResultsEntityTypes = React.useMemo(() => {
    const types = new Set<string>();
    scanResultsEntities.forEach(e => types.add(e.type));
    return Array.from(types).sort();
  }, [scanResultsEntities]);

  return (
    <>
      {/* Stats - Clickable for filtering */}
      {scanResultsEntities.length > 0 && (
        <Box sx={{
          display: 'flex',
          gap: 0,
          mb: 2,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          overflow: 'hidden',
        }}>
          <Box
            onClick={() => setScanResultsFoundFilter(scanResultsFoundFilter === 'found' ? 'all' : 'found')}
            sx={{
              flex: 1,
              textAlign: 'center',
              p: 1.5,
              cursor: 'pointer',
              bgcolor: scanResultsFoundFilter === 'found' ? 'success.main' : 'action.hover',
              color: scanResultsFoundFilter === 'found' ? 'white' : 'inherit',
              transition: 'all 0.15s',
              '&:hover': {
                bgcolor: scanResultsFoundFilter === 'found' ? 'success.dark' : 'action.selected',
              },
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, color: scanResultsFoundFilter === 'found' ? 'inherit' : 'success.main' }}>
              {scanResultsFoundCount}
            </Typography>
            <Typography variant="caption" sx={{ color: scanResultsFoundFilter === 'found' ? 'inherit' : 'text.secondary', opacity: scanResultsFoundFilter === 'found' ? 0.9 : 1 }}>
              Found
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box
            onClick={() => setScanResultsFoundFilter(scanResultsFoundFilter === 'not-found' ? 'all' : 'not-found')}
            sx={{
              flex: 1,
              textAlign: 'center',
              p: 1.5,
              cursor: 'pointer',
              bgcolor: scanResultsFoundFilter === 'not-found' ? 'warning.main' : 'action.hover',
              color: scanResultsFoundFilter === 'not-found' ? 'white' : 'inherit',
              transition: 'all 0.15s',
              '&:hover': {
                bgcolor: scanResultsFoundFilter === 'not-found' ? 'warning.dark' : 'action.selected',
              },
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, color: scanResultsFoundFilter === 'not-found' ? 'inherit' : 'warning.main' }}>
              {scanResultsNotFoundCount}
            </Typography>
            <Typography variant="caption" sx={{ color: scanResultsFoundFilter === 'not-found' ? 'inherit' : 'text.secondary', opacity: scanResultsFoundFilter === 'not-found' ? 0.9 : 1 }}>
              Not Found
            </Typography>
          </Box>
          {/* AI Findings filter - only show if there are AI discoveries */}
          {scanResultsAICount > 0 && (
            <>
              <Divider orientation="vertical" flexItem />
              <Box
                onClick={() => setScanResultsFoundFilter(scanResultsFoundFilter === 'ai-discovered' ? 'all' : 'ai-discovered')}
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  p: 1.5,
                  cursor: 'pointer',
                  bgcolor: scanResultsFoundFilter === 'ai-discovered' ? aiColors.main : 'action.hover',
                  color: scanResultsFoundFilter === 'ai-discovered' ? 'white' : 'inherit',
                  transition: 'all 0.15s',
                  '&:hover': {
                    bgcolor: scanResultsFoundFilter === 'ai-discovered' ? aiColors.dark : 'action.selected',
                  },
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700, color: scanResultsFoundFilter === 'ai-discovered' ? 'inherit' : aiColors.main }}>
                  {scanResultsAICount}
                </Typography>
                <Typography variant="caption" sx={{ color: scanResultsFoundFilter === 'ai-discovered' ? 'inherit' : 'text.secondary', opacity: scanResultsFoundFilter === 'ai-discovered' ? 0.9 : 1 }}>
                  AI Findings
                </Typography>
              </Box>
            </>
          )}
        </Box>
      )}

      {/* Search and Type filter */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'flex-end' }}>
        {/* Search field */}
        <TextField
          size="small"
          placeholder="Search findings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
        {scanResultsEntityTypes.length > 1 && (
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel id="scan-results-type-filter-label">Filter by type</InputLabel>
            <Select
              labelId="scan-results-type-filter-label"
              value={scanResultsTypeFilter}
              label="Filter by type"
              onChange={(e) => setScanResultsTypeFilter(e.target.value)}
            >
              <MenuItem value="all">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>All types</span>
                  <Chip label={scanResultsEntities.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                </Box>
              </MenuItem>
              {scanResultsEntityTypes.map(type => (
                <MenuItem key={type} value={type}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>{formatEntityTypeForDisplay(type)}</span>
                    <Chip label={scanResultsEntities.filter(e => e.type === type).length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>
    </>
  );
};

export default ScanResultsFilters;
