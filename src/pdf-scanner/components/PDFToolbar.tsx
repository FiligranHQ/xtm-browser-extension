/**
 * PDFToolbar Component
 * 
 * Toolbar for PDF viewer with zoom, scan, and panel controls
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';

interface PDFToolbarProps {
  /** Current zoom scale */
  scale: number;
  /** Whether PDF is being scanned */
  scanning: boolean;
  /** Number of selected entities */
  selectedCount: number;
  /** Whether scan results are available */
  hasScanResults: boolean;
  /** Zoom in handler */
  onZoomIn: () => void;
  /** Zoom out handler */
  onZoomOut: () => void;
  /** Rescan handler */
  onRescan: () => void;
  /** Clear highlights handler */
  onClearHighlights: () => void;
  /** Open original PDF handler */
  onOpenOriginal: () => void;
  /** Toggle panel handler */
  onTogglePanel: () => void;
}

export function PDFToolbar({
  scale,
  scanning,
  selectedCount,
  hasScanResults,
  onZoomIn,
  onZoomOut,
  onRescan,
  onClearHighlights,
  onOpenOriginal,
  onTogglePanel,
}: PDFToolbarProps) {
  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1,
        borderRadius: 0,
        bgcolor: 'background.paper',
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Filigran XTM - PDF Viewer
        </Typography>
        {scanning && <CircularProgress size={16} />}
        {selectedCount > 0 && (
          <Typography variant="caption" color="primary">
            ({selectedCount} selected)
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {/* Zoom controls first */}
        <Tooltip title="Zoom out">
          <IconButton size="small" onClick={onZoomOut}>
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </Typography>
        <Tooltip title="Zoom in">
          <IconButton size="small" onClick={onZoomIn}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        
        <Box sx={{ mx: 1, borderLeft: 1, borderColor: 'divider', height: 24 }} />
        
        {/* Action buttons */}
        <Tooltip title={scanning ? "Scanning..." : "Rescan PDF"}>
          <IconButton size="small" onClick={onRescan} disabled={scanning}>
            {scanning ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear highlights">
          <IconButton size="small" onClick={onClearHighlights} disabled={!hasScanResults}>
            <HighlightOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Open original PDF">
          <IconButton size="small" onClick={onOpenOriginal}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        
        {/* Primary Open Results button */}
        <Tooltip title="Open scan results panel">
          <IconButton 
            size="small" 
            onClick={onTogglePanel} 
            disabled={!hasScanResults}
            sx={{
              bgcolor: hasScanResults ? 'primary.main' : 'transparent',
              color: hasScanResults ? 'primary.contrastText' : 'text.secondary',
              '&:hover': {
                bgcolor: hasScanResults ? 'primary.dark' : 'action.hover',
              },
              '&.Mui-disabled': {
                bgcolor: 'transparent',
              },
            }}
          >
            <MenuOpenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}

