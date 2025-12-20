/**
 * Popup App - Main popup component for the XTM browser extension
 */

import React, { useState, useMemo } from 'react';
import { 
  ThemeProvider, 
  createTheme,
  CssBaseline, 
  Box, 
  Typography, 
  IconButton, 
  Divider,
  Tooltip,
  keyframes,
} from '@mui/material';
import {
  SettingsOutlined,
  CloseOutlined,
} from '@mui/icons-material';

// Theme
import themeDark from '../shared/theme/theme-dark';
import themeLight from '../shared/theme/theme-light';

// Components
import { ActionButtonsGrid } from '../shared/components/ActionButtonsGrid';
import { EXTENSION_VERSION } from '../shared/constants';
import { PlatformSetupForm } from './components/PlatformSetupForm';
import { WelcomeScreen } from './components/WelcomeScreen';
import { EETrialDialog } from './components/EETrialDialog';
import { PlatformDetailsPopover } from './components/PlatformDetailsPopover';
import { usePlatformStatus } from './hooks/usePlatformStatus';
import { useSetupWizard } from './hooks/useSetupWizard';
import { usePopupActions } from './hooks/usePopupActions';

// Pulsing animation for connection indicator
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
`;

const App: React.FC = () => {
  // Platform status management
  const platformStatus = usePlatformStatus();
  const {
    status,
    setStatus,
    mode,
    hasOpenCTI,
    hasOpenAEV,
    hasAnyOpenCTIConfigured,
    hasAnyOpenAEVConfigured,
    hasAnyPlatformConfigured,
    hasEnterprise,
    aiConfigured,
    splitScreenMode,
    isPdfPage,
    isPdfScannerPage,
    pdfUrl,
  } = platformStatus;

  // Popover and dialog state
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [showEETrialDialog, setShowEETrialDialog] = useState(false);

  // Setup wizard
  const {
    setupStep,
    isInSetupWizard,
    setupUrl,
    setupToken,
    showSetupToken,
    setupTesting,
    setupError,
    setupSuccess,
    setSetupUrl,
    setSetupToken,
    setShowSetupToken,
    handleSetupTestAndSave,
    handleSetupSkip,
    startSetupWizard,
  } = useSetupWizard({ setStatus });

  // Actions
  const {
    handleUnifiedScan,
    handleUnifiedSearch,
    handleCreateContainer,
    handleInvestigate,
    handleAtomicTesting,
    handleGenerateScenario,
    handleClear,
    handleOpenSettings,
    handleOpenPlatform,
    handleFooterClick,
  } = usePopupActions({
    aiConfigured,
    hasEnterprise,
    splitScreenMode,
    setPopoverAnchor,
    setShowEETrialDialog,
    isPdfPage,
    isPdfScannerPage,
    pdfUrl,
  });

  // Theme
  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? themeDark() : themeLight();
    return createTheme(themeOptions);
  }, [mode]);

  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: 480, minHeight: 340, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <img
              src={`../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`}
              alt="Filigran"
              width={32}
              height={32}
            />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 18, color: mode === 'dark' ? '#ffffff' : 'text.primary' }}>
                  Filigran Threat Management
                </Typography>
              </Box>
            </Box>
          </Box>
          {/* Show close button during setup, settings button otherwise */}
          {(isInSetupWizard || (!hasAnyPlatformConfigured && setupStep === 'welcome')) ? (
            <Tooltip title="Close" arrow>
              <IconButton size="small" onClick={() => window.close()} sx={{ color: 'text.secondary' }}>
                <CloseOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Settings" arrow>
              <IconButton size="small" onClick={handleOpenSettings} sx={{ color: 'primary.main' }}>
                <SettingsOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Divider />

        {/* Welcome Splash when nothing is configured */}
        {!hasAnyPlatformConfigured && !isInSetupWizard && setupStep === 'welcome' && (
          <WelcomeScreen
            logoSuffix={logoSuffix}
            onGetStarted={startSetupWizard}
            onOpenSettings={handleOpenSettings}
          />
        )}
        
        {/* OpenCTI Setup Step */}
        {isInSetupWizard && setupStep === 'opencti' && (
          <PlatformSetupForm
            platformType="opencti"
            logoSuffix={logoSuffix}
            url={setupUrl}
            token={setupToken}
            showToken={showSetupToken}
            testing={setupTesting}
            error={setupError}
            success={setupSuccess}
            onUrlChange={setSetupUrl}
            onTokenChange={setSetupToken}
            onToggleShowToken={() => setShowSetupToken(!showSetupToken)}
            onConnect={() => handleSetupTestAndSave('opencti')}
            onSkip={() => handleSetupSkip('opencti')}
          />
        )}
        
        {/* OpenAEV Setup Step */}
        {isInSetupWizard && setupStep === 'openaev' && (
          <PlatformSetupForm
            platformType="openaev"
            logoSuffix={logoSuffix}
            url={setupUrl}
            token={setupToken}
            showToken={showSetupToken}
            testing={setupTesting}
            error={setupError}
            success={setupSuccess}
            onUrlChange={setSetupUrl}
            onTokenChange={setSetupToken}
            onToggleShowToken={() => setShowSetupToken(!showSetupToken)}
            onConnect={() => handleSetupTestAndSave('openaev')}
            onSkip={() => handleSetupSkip('openaev')}
          />
        )}

        {/* Main Actions Section */}
        {hasAnyPlatformConfigured && !isInSetupWizard && (
          <Box sx={{ p: 2 }}>
            <ActionButtonsGrid
              logoSuffix={logoSuffix}
              hasOpenCTI={hasOpenCTI}
              hasOpenAEV={hasOpenAEV}
              onScan={handleUnifiedScan}
              onSearch={handleUnifiedSearch}
              onCreateContainer={handleCreateContainer}
              onInvestigate={handleInvestigate}
              onAtomicTesting={handleAtomicTesting}
              onGenerateScenario={handleGenerateScenario}
              onClearHighlights={handleClear}
              compact={true}
              dividerMarginX={0}
              isPdfView={isPdfPage || isPdfScannerPage}
            />
          </Box>
        )}

        {/* Footer - Clickable with platform info */}
        <Box sx={{ mt: 'auto' }}>
          <Divider />
          <Box 
            onClick={handleFooterClick}
            sx={{ 
              p: 1.5, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            {/* Connection Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* OpenCTI Status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: hasOpenCTI ? '#4caf50' : hasAnyOpenCTIConfigured ? '#f44336' : '#9e9e9e',
                    animation: hasOpenCTI ? `${pulse} 2s infinite` : undefined,
                  }}
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: hasOpenCTI ? '#4caf50' : hasAnyOpenCTIConfigured ? '#f44336' : '#9e9e9e', 
                    fontSize: 10, 
                    fontWeight: 500 
                  }}
                >
                  {hasOpenCTI 
                    ? `OCTI (${status.opencti.filter(p => p.connected).length})`
                    : hasAnyOpenCTIConfigured ? 'OCTI offline' : 'OCTI'
                  }
                </Typography>
              </Box>
              {/* OpenAEV Status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: hasOpenAEV ? '#4caf50' : hasAnyOpenAEVConfigured ? '#f44336' : '#9e9e9e',
                    animation: hasOpenAEV ? `${pulse} 2s infinite` : undefined,
                  }}
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: hasOpenAEV ? '#4caf50' : hasAnyOpenAEVConfigured ? '#f44336' : '#9e9e9e', 
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  {hasOpenAEV 
                    ? `OAEV (${status.openaev.filter(p => p.connected).length})`
                    : hasAnyOpenAEVConfigured ? 'OAEV offline' : 'OAEV'
                  }
                </Typography>
              </Box>
            </Box>
            {/* Version */}
            <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.7, fontSize: 10 }}>
              v{EXTENSION_VERSION} • Click for details
            </Typography>
          </Box>
        </Box>

        {/* Platform Details Popover */}
        <PlatformDetailsPopover
          anchorEl={popoverAnchor}
          status={status}
          mode={mode}
          logoSuffix={logoSuffix}
          onClose={() => setPopoverAnchor(null)}
          onOpenPlatform={handleOpenPlatform}
        />

        {/* Enterprise Edition Trial Dialog */}
        <EETrialDialog
          open={showEETrialDialog}
          mode={mode}
          onClose={() => setShowEETrialDialog(false)}
          onStartTrial={() => {
            window.open('https://filigran.io/enterprise-editions-trial/', '_blank');
            setShowEETrialDialog(false);
          }}
        />
      </Box>
    </ThemeProvider>
  );
};

export default App;
