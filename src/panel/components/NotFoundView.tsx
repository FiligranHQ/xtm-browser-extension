/**
 * Not Found View Component
 * 
 * Displays when an entity is not found in the platform.
 */

import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { InfoOutlined, AddOutlined, CloseOutlined } from '@mui/icons-material';
import { itemColor, hexToRGB } from '../../shared/theme/colors';
import ItemIcon from '../../shared/components/ItemIcon';
import type { EntityData } from '../types';

interface NotFoundViewProps {
  entity: EntityData | null;
  mode: 'dark' | 'light';
  onAddEntity?: () => void;
  onClose?: () => void;
}

/**
 * View displayed when entity is not found in platform
 */
export const NotFoundView: React.FC<NotFoundViewProps> = ({ 
  entity, 
  mode,
  onAddEntity,
  onClose,
}) => {
  if (!entity) return null;
  
  const type = entity.type || entity.entity_type || 'unknown';
  const color = itemColor(type, mode === 'dark');
  const name = entity.name || entity.value || 'Unknown';
  
  // Determine if this entity type can be added (observables can, SDOs generally can't)
  const isAddable = ![
    'Vulnerability', 'Threat-Actor', 'Threat-Actor-Group', 'Threat-Actor-Individual',
    'Intrusion-Set', 'Malware', 'Attack-Pattern', 'Tool', 'Campaign',
  ].includes(type);

  return (
    <Box sx={{ p: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          py: 4,
        }}
      >
        {/* Type Badge */}
        <Box
          sx={{
            display: 'flex',
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
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 700, 
              color, 
              textTransform: 'capitalize',
              letterSpacing: '0.5px',
            }}
          >
            {type.replace(/-/g, ' ')}
          </Typography>
        </Box>

        {/* Value */}
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 2, 
            wordBreak: 'break-word',
            maxWidth: '100%',
          }}
        >
          {name}
        </Typography>

        {/* Not Found Message */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1.5,
            mb: 3,
            borderRadius: 1,
            bgcolor: mode === 'dark' ? 'rgba(255, 167, 38, 0.1)' : 'rgba(255, 167, 38, 0.08)',
            border: '1px solid',
            borderColor: mode === 'dark' ? 'rgba(255, 167, 38, 0.3)' : 'rgba(255, 167, 38, 0.2)',
          }}
        >
          <InfoOutlined sx={{ color: '#ffa726', fontSize: 20 }} />
          <Typography variant="body2" sx={{ color: '#ffa726' }}>
            Not found in the platform
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, width: '100%', maxWidth: 280 }}>
          {isAddable && onAddEntity && (
            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              onClick={onAddEntity}
              fullWidth
            >
              Add to Platform
            </Button>
          )}
          {onClose && (
            <Button
              variant="outlined"
              startIcon={<CloseOutlined />}
              onClick={onClose}
              fullWidth={!isAddable}
            >
              Close
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default NotFoundView;

