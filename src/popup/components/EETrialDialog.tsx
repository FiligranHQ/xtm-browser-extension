/**
 * EETrialDialog - Enterprise Edition trial promotion dialog
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AutoAwesomeOutlined,
  RocketLaunchOutlined,
} from '@mui/icons-material';
import type { EETrialDialogProps } from '../types';

export const EETrialDialog: React.FC<EETrialDialogProps> = ({
  open,
  mode,
  onClose,
  onStartTrial,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 2,
          minWidth: 380,
          background: mode === 'dark' 
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' 
            : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        }
      }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center', 
        pt: 4,
        pb: 1,
      }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 2 
        }}>
          <Box sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00bcd4, #0097a7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0, 188, 212, 0.3)',
          }}>
            <AutoAwesomeOutlined sx={{ fontSize: 32, color: '#fff' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Unlock AI Features
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', px: 4, pb: 2 }}>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
          AI-powered features like scenario generation and on-the-fly atomic testing require an{' '}
          <strong>Enterprise Edition</strong> license.
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Start your free 30-day trial to experience the full power of Filigran's XTM platform with AI capabilities.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ 
        flexDirection: 'column', 
        gap: 1.5, 
        px: 4, 
        pb: 4,
        pt: 1,
      }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          startIcon={<RocketLaunchOutlined />}
          onClick={onStartTrial}
          sx={{
            background: 'linear-gradient(135deg, #00bcd4, #0097a7)',
            py: 1.5,
            fontWeight: 600,
            '&:hover': {
              background: 'linear-gradient(135deg, #0097a7, #00838f)',
            },
          }}
        >
          Start Free Trial
        </Button>
        <Button
          fullWidth
          variant="text"
          onClick={onClose}
          sx={{ color: 'text.secondary' }}
        >
          Maybe later
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EETrialDialog;

