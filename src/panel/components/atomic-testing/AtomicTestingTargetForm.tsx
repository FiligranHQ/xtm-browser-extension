/**
 * Atomic Testing Target Form Component
 *
 * Reusable form for configuring atomic testing targets.
 * Handles both AI-generated payload scenarios and manual target selection.
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Autocomplete,
} from '@mui/material';
import {
  ComputerOutlined,
  LanOutlined,
} from '@mui/icons-material';

export interface Asset {
  asset_id: string;
  asset_name?: string;
  endpoint_hostname?: string;
}

export interface AssetGroup {
  asset_group_id: string;
  asset_group_name?: string;
}

export interface AtomicTestingTargetFormProps {
  /** Test title value */
  title: string;
  /** Title change handler */
  onTitleChange: (title: string) => void;
  /** Placeholder for title field */
  titlePlaceholder: string;
  /** Currently selected target type */
  targetType: 'asset' | 'asset_group';
  /** Target type change handler */
  onTargetTypeChange: (type: 'asset' | 'asset_group') => void;
  /** Available assets */
  assets: Asset[];
  /** Selected asset ID */
  selectedAssetId: string | null;
  /** Asset selection handler */
  onAssetSelect: (assetId: string | null) => void;
  /** Available asset groups */
  assetGroups: AssetGroup[];
  /** Selected asset group ID */
  selectedAssetGroupId: string | null;
  /** Asset group selection handler */
  onAssetGroupSelect: (assetGroupId: string | null) => void;
}

/**
 * Form component for selecting atomic testing target (asset or asset group).
 * Used in both AI-generated payload flow and manual target selection flow.
 */
export const AtomicTestingTargetForm: React.FC<AtomicTestingTargetFormProps> = ({
  title,
  onTitleChange,
  titlePlaceholder,
  targetType,
  onTargetTypeChange,
  assets,
  selectedAssetId,
  onAssetSelect,
  assetGroups,
  selectedAssetGroupId,
  onAssetGroupSelect,
}) => {
  return (
    <>
      <TextField
        label="Test Title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={titlePlaceholder}
        size="small"
        fullWidth
      />

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          Target Type
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={targetType === 'asset' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => onTargetTypeChange('asset')}
            startIcon={<ComputerOutlined />}
            sx={{ flex: 1, minWidth: 0 }}
          >
            Asset
          </Button>
          <Button
            variant={targetType === 'asset_group' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => onTargetTypeChange('asset_group')}
            startIcon={<LanOutlined />}
            sx={{ flex: 1, minWidth: 0 }}
          >
            Asset Group
          </Button>
        </Box>
      </Box>

      {targetType === 'asset' ? (
        <Autocomplete
          options={assets}
          getOptionLabel={(option) => option.asset_name || option.endpoint_hostname || 'Unknown'}
          value={assets.find((a) => a.asset_id === selectedAssetId) || null}
          onChange={(_, value) => onAssetSelect(value?.asset_id || null)}
          renderInput={(params) => <TextField {...params} label="Select Asset" size="small" />}
          size="small"
        />
      ) : (
        <Autocomplete
          options={assetGroups}
          getOptionLabel={(option) => option.asset_group_name || 'Unknown'}
          value={assetGroups.find((g) => g.asset_group_id === selectedAssetGroupId) || null}
          onChange={(_, value) => onAssetGroupSelect(value?.asset_group_id || null)}
          renderInput={(params) => <TextField {...params} label="Select Asset Group" size="small" />}
          size="small"
        />
      )}
    </>
  );
};

