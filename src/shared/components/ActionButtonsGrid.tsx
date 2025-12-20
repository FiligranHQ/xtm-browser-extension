/**
 * ActionButtonsGrid - Shared grid of action buttons
 * Used in both popup and panel for consistent layout
 */

import React from 'react';
import { Box, Typography, Divider, Button } from '@mui/material';
import {
  CenterFocusStrongOutlined,
  SearchOutlined,
  DescriptionOutlined,
  TravelExploreOutlined,
  MovieFilterOutlined,
} from '@mui/icons-material';
import { Target } from 'mdi-material-ui';
import { ActionButton } from './ActionButton';

export interface ActionButtonsGridProps {
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
  /** Use compact styling (smaller buttons, margins) - default true */
  compact?: boolean;
  /** Horizontal margin for dividers - default 0 */
  dividerMarginX?: number;
}

export const ActionButtonsGrid: React.FC<ActionButtonsGridProps> = ({
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
  compact = true,
  dividerMarginX = 0,
}) => {
  const sectionPadding = compact ? 1 : 2;
  const sectionMarginBottom = compact ? 1 : 1.5;
  const logoSize = compact ? 16 : 18;
  const titleFontSize = compact ? 12 : 13;
  const subtitleFontSize = 10;

  return (
    <>
      {/* Global Actions - Scan & Search across all platforms */}
      <Box sx={{ mb: sectionMarginBottom }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1,
          }}
        >
          <ActionButton
            icon={<CenterFocusStrongOutlined />}
            label="Scan"
            subtitle="Find entities across platforms"
            tooltip="Scan page for entities in OpenCTI and OpenAEV"
            onClick={onScan}
            color="#2196f3"
            compact={compact}
          />
          <ActionButton
            icon={<SearchOutlined />}
            label="Search"
            subtitle="Query all platforms"
            tooltip="Search across OpenCTI and OpenAEV"
            onClick={onSearch}
            color="#7c4dff"
            disabled={!hasOpenCTI && !hasOpenAEV}
            compact={compact}
          />
        </Box>
      </Box>

      <Divider sx={{ mx: dividerMarginX, my: sectionPadding }} />

      {/* OpenCTI Section */}
      <Box sx={{ mb: sectionMarginBottom }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: sectionMarginBottom }}>
          <img
            src={`../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`}
            alt="OpenCTI"
            width={logoSize}
            height={logoSize}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: titleFontSize }}>
            OpenCTI
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: subtitleFontSize }}>
            Threat Intelligence
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1,
          }}
        >
          <ActionButton
            icon={<DescriptionOutlined />}
            label="Container"
            subtitle="Create report"
            tooltip="Create container from page content"
            onClick={onCreateContainer}
            color="#4caf50"
            disabled={!hasOpenCTI}
            compact={compact}
          />
          <ActionButton
            icon={<TravelExploreOutlined />}
            label="Investigate"
            subtitle="Start an investigation"
            tooltip="Start investigation with entities"
            onClick={onInvestigate}
            color="#5c6bc0"
            disabled={!hasOpenCTI}
            compact={compact}
          />
        </Box>
      </Box>

      <Divider sx={{ mx: dividerMarginX, my: sectionPadding }} />

      {/* OpenAEV Section */}
      <Box sx={{ mb: sectionMarginBottom }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: sectionMarginBottom }}>
          <img
            src={`../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`}
            alt="OpenAEV"
            width={logoSize}
            height={logoSize}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: titleFontSize }}>
            OpenAEV
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: subtitleFontSize }}>
            Adversarial Exposure Validation
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1,
          }}
        >
          <ActionButton
            icon={<Target />}
            label="Atomic Test"
            subtitle="Trigger a test"
            tooltip="Create atomic testing from attack pattern or domain"
            onClick={onAtomicTesting}
            color="#f44336"
            disabled={!hasOpenAEV}
            compact={compact}
          />
          <ActionButton
            icon={<MovieFilterOutlined />}
            label="Scenario"
            subtitle="Generate attack"
            tooltip="Generate attack scenario from page"
            onClick={onGenerateScenario}
            color="#e91e63"
            disabled={!hasOpenAEV}
            compact={compact}
          />
        </Box>
      </Box>

      <Divider sx={{ mx: dividerMarginX, my: sectionPadding }} />

      {/* Clear Button */}
      <Box>
        <Button
          fullWidth
          variant="outlined"
          onClick={onClearHighlights}
          sx={{ 
            height: 32,
            borderRadius: 1,
            borderColor: 'divider',
            color: 'text.secondary',
            fontSize: 12,
            '&:hover': {
              borderColor: 'text.secondary',
              bgcolor: 'action.hover',
            },
          }}
        >
          Clear highlights
        </Button>
      </Box>
    </>
  );
};

export default ActionButtonsGrid;
