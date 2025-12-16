/**
 * OpenAEV Search View Component
 *
 * Dedicated search interface for OpenAEV platform.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  SearchOutlined,
  ChevronRightOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { hexToRGB } from '../../shared/theme/colors';
import { getOAEVTypeFromClass, getOAEVEntityName, getOAEVEntityColor } from '../../shared/utils/entity';
import type { PlatformInfo } from '../types';

export interface OAEVSearchViewProps {
  availablePlatforms: PlatformInfo[];
  oaevSearchQuery: string;
  setOaevSearchQuery: (query: string) => void;
  oaevSearching: boolean;
  oaevSearchResults: any[];
  handleOaevSearch: () => void;
  handleOaevSearchResultClick: (result: any) => void;
}

export const OAEVSearchView: React.FC<OAEVSearchViewProps> = ({
  availablePlatforms,
  oaevSearchQuery,
  setOaevSearchQuery,
  oaevSearching,
  oaevSearchResults,
  handleOaevSearch,
  handleOaevSearchResultClick,
}) => {
  const oaevPlatforms = availablePlatforms.filter(p => p.type === 'openaev');
  const hasSearched = oaevSearchResults.length > 0 || (oaevSearchQuery.trim() && !oaevSearching);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Search OpenAEV</Typography>

      <TextField
        placeholder="Search entities..."
        value={oaevSearchQuery}
        onChange={(e) => setOaevSearchQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleOaevSearch()}
        fullWidth
        autoFocus
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={handleOaevSearch} edge="end" disabled={oaevSearching}>
                {oaevSearching ? <CircularProgress size={20} /> : <SearchOutlined />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      {/* Results section */}
      {oaevSearching ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 1 }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Searching across {oaevPlatforms.length} platform{oaevPlatforms.length > 1 ? 's' : ''}...
          </Typography>
        </Box>
      ) : hasSearched && oaevSearchResults.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No results found for "{oaevSearchQuery}"
          </Typography>
        </Box>
      ) : oaevSearchResults.length > 0 ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {oaevSearchResults.length} result{oaevSearchResults.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {oaevSearchResults.map((result, i) => {
              const entityClass = result._entityClass || '';
              const oaevType = getOAEVTypeFromClass(entityClass);
              const displayName = getOAEVEntityName(result, oaevType);
              const platformInfo = result._platform;
              const entityColor = getOAEVEntityColor(getOAEVTypeFromClass(entityClass));
              const typeForIcon = `oaev-${oaevType}`;

              return (
                <Paper
                  key={result.id || i}
                  onClick={() => handleOaevSearchResultClick(result)}
                  elevation={0}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    mb: 1,
                    cursor: 'pointer',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    transition: 'all 0.15s',
                    '&:hover': {
                      bgcolor: hexToRGB(entityColor, 0.08),
                      borderColor: entityColor,
                    },
                  }}
                >
                  {/* Entity type icon with color */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      bgcolor: hexToRGB(entityColor, 0.15),
                      flexShrink: 0,
                    }}
                  >
                    <ItemIcon
                      type={typeForIcon}
                      size="small"
                      color={entityColor}
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                      {displayName}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: entityColor,
                          fontWeight: 500,
                        }}
                      >
                        {oaevType.replace(/([A-Z])/g, ' $1').trim()}
                      </Typography>
                      {platformInfo && (
                        <>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>·</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {platformInfo.name || platformInfo.url}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </Box>
                  <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                </Paper>
              );
            })}
          </Box>
        </>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Enter a search term and press Enter or click the search icon
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default OAEVSearchView;

