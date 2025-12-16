/**
 * Import Results View Component
 * 
 * Displays the results of an entity import operation.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
} from '@mui/material';
import {
  CheckCircleOutlined,
  ErrorOutline,
  ChevronRightOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import type { PanelMode, ImportResults } from '../types';

export interface ImportResultsViewProps {
  mode: 'dark' | 'light';
  importResults: ImportResults | null;
  setPanelMode: (mode: PanelMode) => void;
  setImportResults: (results: ImportResults | null) => void;
  platformUrl: string;
}

export const ImportResultsView: React.FC<ImportResultsViewProps> = ({
  mode,
  importResults,
  setPanelMode,
  setImportResults,
  platformUrl,
}) => {
  if (!importResults) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No import results available
        </Typography>
      </Box>
    );
  }

  const { success, total, created, failed, platformName } = importResults;
  const hasCreated = created.length > 0;
  const hasFailed = failed.length > 0;

  const handleDone = () => {
    setImportResults(null);
    setPanelMode('scan-results');
  };

  const handleOpenInPlatform = (entityId: string) => {
    if (!platformUrl || !entityId) return;
    
    const url = `${platformUrl}/dashboard/id/${entityId}`;
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header with status */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5, 
        mb: 3,
        p: 2,
        borderRadius: 1,
        bgcolor: success ? hexToRGB('#4caf50', 0.1) : hexToRGB('#f44336', 0.1),
        border: 1,
        borderColor: success ? 'success.main' : 'error.main',
      }}>
        {success ? (
          <CheckCircleOutlined sx={{ color: 'success.main', fontSize: 32 }} />
        ) : (
          <ErrorOutline sx={{ color: 'error.main', fontSize: 32 }} />
        )}
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {success ? 'Import Successful' : 'Import Completed with Errors'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {created.length} of {total} entities imported to {platformName}
          </Typography>
        </Box>
      </Box>

      {/* Created entities */}
      {hasCreated && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <CheckCircleOutlined sx={{ color: 'success.main', fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Created ({created.length})
            </Typography>
          </Box>
          <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {created.map((entity, i) => {
              const entityColor = itemColor(entity.type, mode === 'dark');
              
              return (
                <Paper
                  key={entity.id || i}
                  elevation={0}
                  onClick={() => handleOpenInPlatform(entity.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderBottom: i < created.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                    bgcolor: 'transparent',
                    cursor: entity.id ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    '&:hover': entity.id ? {
                      bgcolor: hexToRGB(entityColor, 0.08),
                    } : {},
                  }}
                >
                  <ItemIcon type={entity.type} size="small" color={entityColor} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                      {entity.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: entityColor }}>
                      {entity.type.replace(/-/g, ' ')}
                    </Typography>
                  </Box>
                  {entity.id && (
                    <ChevronRightOutlined sx={{ color: 'text.secondary', fontSize: 18 }} />
                  )}
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Failed entities */}
      {hasFailed && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <ErrorOutline sx={{ color: 'error.main', fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'error.main' }}>
              Failed ({failed.length})
            </Typography>
          </Box>
          <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'error.main', borderRadius: 1, bgcolor: hexToRGB('#f44336', 0.05) }}>
            {failed.map((entity, i) => (
              <Paper
                key={i}
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderBottom: i < failed.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                  bgcolor: 'transparent',
                }}
              >
                <ItemIcon type={entity.type} size="small" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                    {entity.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {entity.type.replace(/-/g, ' ')}
                  </Typography>
                  {entity.error && (
                    <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.25 }}>
                      {entity.error}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label="Failed"
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant="contained"
          fullWidth
          onClick={handleDone}
        >
          Done
        </Button>
      </Box>
    </Box>
  );
};

export default ImportResultsView;

