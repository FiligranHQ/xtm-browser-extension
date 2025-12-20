/**
 * Scan Results Filters Component
 * 
 * Renders filter controls for entity type, found status, and search.
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
  IconButton,
} from '@mui/material';
import {
  SearchOutlined,
  ClearAllOutlined,
} from '@mui/icons-material';
import { hexToRGB } from '../../../shared/theme/colors';
import type { ScanResultEntity } from '../../types/panel-types';

interface ScanResultsFiltersProps {
  scanResultsEntities: ScanResultEntity[];
  scanResultsTypeFilter: string;
  setScanResultsTypeFilter: (filter: string) => void;
  scanResultsFoundFilter: string;
  setScanResultsFoundFilter: (filter: string) => void;
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

  const clearFilters = () => {
    setScanResultsFoundFilter('all');
    setScanResultsTypeFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = scanResultsFoundFilter !== 'all' || scanResultsTypeFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <>
      {/* Search input */}
      <Box sx={{ mb: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search entities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            sx: { fontSize: '0.85rem' },
          }}
        />
      </Box>

      {/* Status filter chips */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={`All (${scanResultsEntities.length})`}
          size="small"
          variant={scanResultsFoundFilter === 'all' ? 'filled' : 'outlined'}
          onClick={() => setScanResultsFoundFilter('all')}
          sx={{ cursor: 'pointer', fontSize: '0.75rem', height: 24 }}
        />
        <Chip
          label={`Found (${scanResultsFoundCount})`}
          size="small"
          color="success"
          variant={scanResultsFoundFilter === 'found' ? 'filled' : 'outlined'}
          onClick={() => setScanResultsFoundFilter('found')}
          sx={{ cursor: 'pointer', fontSize: '0.75rem', height: 24 }}
        />
        <Chip
          label={`New (${scanResultsNotFoundCount})`}
          size="small"
          color="warning"
          variant={scanResultsFoundFilter === 'not-found' ? 'filled' : 'outlined'}
          onClick={() => setScanResultsFoundFilter('not-found')}
          sx={{ cursor: 'pointer', fontSize: '0.75rem', height: 24 }}
        />
        {scanResultsAICount > 0 && (
          <Chip
            label={`AI (${scanResultsAICount})`}
            size="small"
            variant={scanResultsFoundFilter === 'ai-discovered' ? 'filled' : 'outlined'}
            onClick={() => setScanResultsFoundFilter('ai-discovered')}
            sx={{ 
              cursor: 'pointer', 
              fontSize: '0.75rem', 
              height: 24,
              bgcolor: scanResultsFoundFilter === 'ai-discovered' ? aiColors.main : 'transparent',
              color: scanResultsFoundFilter === 'ai-discovered' ? 'white' : aiColors.main,
              borderColor: aiColors.main,
              '&:hover': {
                bgcolor: scanResultsFoundFilter === 'ai-discovered' ? aiColors.dark : hexToRGB(aiColors.main, 0.08),
              },
            }}
          />
        )}
        {hasActiveFilters && (
          <IconButton
            size="small"
            onClick={clearFilters}
            sx={{ p: 0.5 }}
          >
            <ClearAllOutlined sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      {/* Type filter dropdown */}
      <Box sx={{ mb: 1.5 }}>
        {scanResultsEntityTypes.length > 1 && (
          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: '0.85rem' }}>Filter by type</InputLabel>
            <Select
              value={scanResultsTypeFilter}
              label="Filter by type"
              onChange={(e) => setScanResultsTypeFilter(e.target.value)}
              sx={{ fontSize: '0.85rem' }}
            >
              <MenuItem value="all">
                <Typography variant="body2">All types</Typography>
              </MenuItem>
              {scanResultsEntityTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Typography variant="body2">{type.replace(/-/g, ' ')}</Typography>
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

