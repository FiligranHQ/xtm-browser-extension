/**
 * Import Results View Component
 *
 * Displays the results of an entity import operation with detailed breakdown.
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
} from '@mui/material';
import {
  CheckCircleOutlined,
  ErrorOutline,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import type { PanelMode, ImportResults } from '../types';

export interface ImportResultsViewProps {
  mode: 'dark' | 'light';
  importResults: ImportResults | null;
  setImportResults: (results: ImportResults | null) => void;
  handleClose: () => void;
  logoSuffix: string;
}

export const ImportResultsView: React.FC<ImportResultsViewProps> = ({
  mode,
  importResults,
  setImportResults,
  handleClose,
  logoSuffix,
}) => {
  // Group created entities by type for statistics
  const { typeStats, sortedTypes } = useMemo(() => {
    if (!importResults) return { typeStats: {}, sortedTypes: [] };

    const stats = importResults.created.reduce((acc, entity) => {
      const type = entity.type || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(entity);
      return acc;
    }, {} as Record<string, typeof importResults.created>);

    const sorted = Object.entries(stats).sort((a, b) => b[1].length - a[1].length);

    return { typeStats: stats, sortedTypes: sorted };
  }, [importResults]);

  if (!importResults) return null;

  return (
    <Box sx={{ p: 2 }}>
      {/* Success/Error header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          mb: 3,
          p: 3,
          bgcolor: importResults.success ? 'success.main' : 'error.main',
          borderRadius: 2,
          color: 'white',
        }}
      >
        {importResults.success ? (
          <CheckCircleOutlined sx={{ fontSize: 48, mb: 1 }} />
        ) : (
          <ErrorOutline sx={{ fontSize: 48, mb: 1 }} />
        )}
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
          {importResults.success ? 'Import Successful!' : 'Import Failed'}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          {importResults.success
            ? `${importResults.created.length} entit${importResults.created.length === 1 ? 'y' : 'ies'} created in ${importResults.platformName}`
            : `Failed to create ${importResults.failed.length} entit${importResults.failed.length === 1 ? 'y' : 'ies'}`
          }
        </Typography>
      </Box>

      {/* Platform indicator */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          mb: 2.5,
          p: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <img
          src={typeof chrome !== 'undefined' && chrome.runtime?.getURL
            ? chrome.runtime.getURL(`assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`)
            : `../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`
          }
          alt="OpenCTI"
          width={20}
          height={20}
        />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {importResults.platformName}
        </Typography>
      </Box>

      {/* Statistics breakdown by type */}
      {importResults.success && sortedTypes.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
            BREAKDOWN BY TYPE
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sortedTypes.map(([type, entities]) => {
              const color = itemColor(type, mode === 'dark');
              return (
                <Box
                  key={type}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    bgcolor: hexToRGB(color, 0.08),
                    border: 1,
                    borderColor: hexToRGB(color, 0.2),
                    borderRadius: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      bgcolor: hexToRGB(color, 0.15),
                    }}
                  >
                    <ItemIcon type={type} size="small" color={color} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {type.replace(/-/g, ' ')}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: color,
                      color: mode === 'dark' ? '#1a1a2e' : 'white',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {entities.length}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Created entities list */}
      {importResults.success && importResults.created.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 600 }}>
            CREATED ENTITIES ({importResults.created.length})
          </Typography>
          <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {importResults.created.map((entity, idx) => {
              const color = itemColor(entity.type, mode === 'dark');
              return (
                <Box
                  key={entity.id || idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderBottom: idx < importResults.created.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <ItemIcon type={entity.type} size="small" color={color} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entity.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                      {entity.type.replace(/-/g, ' ')}
                    </Typography>
                  </Box>
                  <CheckCircleOutlined sx={{ fontSize: 18, color: 'success.main' }} />
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Failed entities list */}
      {importResults.failed.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'error.main', fontWeight: 600 }}>
            FAILED ({importResults.failed.length})
          </Typography>
          <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'error.main', borderRadius: 1, bgcolor: 'error.dark', opacity: 0.1 }}>
            {importResults.failed.map((entity, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderBottom: idx < importResults.failed.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                }}
              >
                <ItemIcon type={entity.type} size="small" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                    {entity.value}
                  </Typography>
                  {entity.error && (
                    <Typography variant="caption" sx={{ color: 'error.main' }}>
                      {entity.error}
                    </Typography>
                  )}
                </Box>
                <ErrorOutline sx={{ fontSize: 18, color: 'error.main' }} />
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          onClick={() => {
            setImportResults(null);
            handleClose();
          }}
          fullWidth
          startIcon={<CheckCircleOutlined />}
        >
          Done
        </Button>
      </Box>
    </Box>
  );
};

export default ImportResultsView;
