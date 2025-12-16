/**
 * Sidebar Component
 * Navigation sidebar for the Options page
 */
import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  InfoOutlined,
  PaletteOutlined,
  CenterFocusStrongOutlined,
} from '@mui/icons-material';
import type { TabType } from '../constants';
import type { ExtensionSettings } from '../../shared/types';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  mode: 'dark' | 'light';
  settings: ExtensionSettings | null;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, mode, settings }) => {
  const navItems = [
    { 
      id: 'opencti' as TabType, 
      label: 'OpenCTI', 
      icon: (
        <img 
          src={`../assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
          alt="OpenCTI" 
          width={20} 
          height={20}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )
    },
    { 
      id: 'openaev' as TabType, 
      label: 'OpenAEV', 
      icon: (
        <img 
          src={`../assets/logos/logo_openaev_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
          alt="OpenAEV" 
          width={20} 
          height={20}
          onError={(e) => { 
            // Fallback to filigran logo if openaev fails
            (e.target as HTMLImageElement).src = `../assets/logos/logo_filigran_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`;
          }}
        />
      )
    },
    { 
      id: 'ai' as TabType, 
      label: 'Agentic AI', 
      icon: (
        <img 
          src={`../assets/logos/logo_xtm-one_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
          alt="XTM One" 
          width={20} 
          height={20}
          onError={(e) => { 
            // Fallback to AutoAwesome icon if logo fails
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ),
      // Agentic AI is only available if at least one platform is Enterprise Edition
      disabled: ![
        ...(settings?.openctiPlatforms || []),
        ...(settings?.openaevPlatforms || []),
      ].some((p: any) => p.isEnterprise),
      badge: ![
        ...(settings?.openctiPlatforms || []),
        ...(settings?.openaevPlatforms || []),
      ].some((p: any) => p.isEnterprise) ? 'EE' : undefined,
    },
    { 
      id: 'detection' as TabType, 
      label: 'Detection', 
      icon: <CenterFocusStrongOutlined sx={{ fontSize: 20 }} />,
      disabled: (settings?.openctiPlatforms?.length || 0) === 0 && (settings?.openaevPlatforms?.length || 0) === 0,
    },
    { id: 'appearance' as TabType, label: 'Appearance', icon: <PaletteOutlined sx={{ fontSize: 20 }} /> },
    { id: 'about' as TabType, label: 'About', icon: <InfoOutlined sx={{ fontSize: 20 }} /> },
  ];

  return (
    <Box
      sx={{
        width: 220,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <img
            src={`../assets/logos/logo_filigran_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
            alt="Filigran"
            width={24}
            height={24}
          />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 11, lineHeight: 1.2 }}>
              Filigran Threat Management
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Navigation - OpenCTI-style */}
      <List sx={{ flex: 1, py: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.id}
            selected={activeTab === item.id}
            onClick={() => !item.disabled && setActiveTab(item.id)}
            disabled={item.disabled}
            sx={{
              mx: 1,
              borderRadius: 1,
              mb: 0.5,
              height: 40,
              '&.Mui-selected': {
                bgcolor: 'rgba(0, 188, 212, 0.08)',
                borderLeft: '3px solid',
                borderLeftColor: 'primary.main',
                '&:hover': {
                  bgcolor: 'rgba(0, 188, 212, 0.12)',
                },
              },
              '&:hover': {
                bgcolor: 'action.hover',
              },
              '&.Mui-disabled': {
                opacity: 0.5,
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: item.disabled ? 'text.disabled' : activeTab === item.id ? 'primary.main' : 'text.secondary' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.label} 
              primaryTypographyProps={{ 
                fontSize: 13, 
                fontWeight: activeTab === item.id ? 600 : 400,
                color: item.disabled ? 'text.disabled' : activeTab === item.id ? 'primary.main' : 'text.primary',
              }} 
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
};

export default Sidebar;

