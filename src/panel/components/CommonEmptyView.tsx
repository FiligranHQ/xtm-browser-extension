/**
 * EmptyView - Displayed when no entity is selected
 * Shows action buttons similar to the popup for consistency
 */

import React from 'react';
import { Box } from '@mui/material';
import { ActionButtonsGrid } from '../../shared/components/ActionButtonsGrid';

export interface CommonEmptyViewProps {
  logoSuffix: string;
  hasOpenCTI: boolean;
  hasOpenAEV: boolean;
  onScan: () => void;
  onSearch: () => void;
  onCreateContainer: () => void;
  onInvestigate: () => void;
  onAtomicTesting: () => void;
  onGenerateScenario: () => void;
  onClearHighlights: () => void;
  /** Whether viewing a PDF (native or scanner) - disables non-scan/search actions */
  isPdfView?: boolean;
}

export const CommonEmptyView: React.FC<CommonEmptyViewProps> = ({
  logoSuffix,
  hasOpenCTI,
  hasOpenAEV,
  onScan,
  onSearch,
  onCreateContainer,
  onInvestigate,
  onAtomicTesting,
  onGenerateScenario,
  onClearHighlights,
  isPdfView = false,
}) => (
  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
    <ActionButtonsGrid
      logoSuffix={logoSuffix}
      hasOpenCTI={hasOpenCTI}
      hasOpenAEV={hasOpenAEV}
      onScan={onScan}
      onSearch={onSearch}
      onCreateContainer={onCreateContainer}
      onInvestigate={onInvestigate}
      onAtomicTesting={onAtomicTesting}
      onGenerateScenario={onGenerateScenario}
      onClearHighlights={onClearHighlights}
      compact={true}
      dividerMarginX={0}
      isPdfView={isPdfView}
    />
  </Box>
);

export default CommonEmptyView;
