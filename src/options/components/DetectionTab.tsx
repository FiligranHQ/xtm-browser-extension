/**
 * Detection Tab Component
 * Configuration for entity detection settings
 */
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Switch,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  RefreshOutlined,
  RestartAltOutlined,
} from '@mui/icons-material';
import type { ExtensionSettings } from '../../shared/types';
import { type CacheStats, OBSERVABLE_TYPES, OPENCTI_TYPES, OPENAEV_TYPES } from '../constants';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor } from '../../shared/theme/colors';

interface DetectionTabProps {
  settings: ExtensionSettings;
  cacheStats: CacheStats | null;
  isRefreshingCache: boolean;
  mode: 'dark' | 'light';
  onUpdateSetting: <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => void;
  onRefreshCache: () => void;
  onResetDetection: () => void;
  onSave: () => void;
}

const DetectionTab: React.FC<DetectionTabProps> = ({
  settings,
  cacheStats,
  isRefreshingCache,
  mode,
  onUpdateSetting,
  onRefreshCache,
  onResetDetection,
  onSave,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Detection Settings</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Configure how entities are detected on web pages
      </Typography>

      <Box sx={{ flex: 1 }}>
        <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Scan Behavior</Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.autoScan}
                onChange={(e) => onUpdateSetting('autoScan', e.target.checked)}
                color="success"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Auto-scan on page load</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Automatically scan pages when they finish loading
                </Typography>
              </Box>
            }
            sx={{ mb: 2, alignItems: 'flex-start' }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.showNotifications}
                onChange={(e) => onUpdateSetting('showNotifications', e.target.checked)}
                color="success"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Show notifications</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Display notifications for scan results
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start' }}
          />
        </Paper>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Button variant="contained" onClick={onSave}>
            Save Scan Behavior
          </Button>
        </Box>

        <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Entity Cache</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Cached entities for offline detection
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: cacheStats?.byPlatform?.length ? 2 : 0 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {cacheStats ? `${cacheStats.total} entities cached` : 'No cache data'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {isRefreshingCache 
                  ? 'Refreshing cache...' 
                  : cacheStats 
                    ? `Last updated ${cacheStats.age} minutes ago` 
                    : 'Cache not initialized'}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={isRefreshingCache ? <CircularProgress size={16} /> : <RefreshOutlined />}
              onClick={onRefreshCache}
              disabled={isRefreshingCache}
            >
              {isRefreshingCache ? 'Refreshing...' : 'Refresh Cache'}
            </Button>
          </Box>
          
          {/* Per-platform breakdown - OpenCTI */}
          {cacheStats?.byPlatform && cacheStats.byPlatform.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 1, display: 'block' }}>
                OpenCTI Platforms
              </Typography>
              {cacheStats.byPlatform.map((platform) => (
                <Box key={platform.platformId} sx={{ mb: 2 }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      py: 0.5,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <img
                        src={`../assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
                        alt="OpenCTI"
                        width={16}
                        height={16}
                      />
                      <Typography variant="body2">{platform.platformName}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {platform.total === 0 && platform.age === 0
                        ? 'Building cache...' 
                        : `${platform.total} entities • ${platform.age}m ago`}
                    </Typography>
                  </Box>
                  {/* Type breakdown - always visible */}
                  {Object.keys(platform.byType).length > 0 && (
                    <Box sx={{ pl: 3, pt: 0.5 }}>
                      {Object.entries(platform.byType)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => (
                          <Box 
                            key={type}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              py: 0.25,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <ItemIcon type={type.toLowerCase()} size="small" color={itemColor(type, mode === 'dark')} />
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: 'text.primary',
                                  fontWeight: 500,
                                }}
                              >
                                {type.replace(/-/g, ' ')}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>
                              {count}
                            </Typography>
                          </Box>
                        ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Per-platform breakdown - OpenAEV */}
          {cacheStats?.oaevByPlatform && cacheStats.oaevByPlatform.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 1, display: 'block' }}>
                OpenAEV Platforms
              </Typography>
              {cacheStats.oaevByPlatform.map((platform) => (
                <Box key={platform.platformId} sx={{ mb: 2 }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      py: 0.5,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <img
                        src={`../assets/logos/logo_openaev_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
                        alt="OpenAEV"
                        width={16}
                        height={16}
                      />
                      <Typography variant="body2">{platform.platformName}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {platform.total === 0 && platform.age === 0
                        ? 'Building cache...' 
                        : `${platform.total} entities • ${platform.age}m ago`}
                    </Typography>
                  </Box>
                  {/* Type breakdown - always visible */}
                  {Object.keys(platform.byType).length > 0 && (
                    <Box sx={{ pl: 3, pt: 0.5 }}>
                      {Object.entries(platform.byType)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => (
                          <Box 
                            key={type}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              py: 0.25,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <ItemIcon type={type.toLowerCase()} size="small" color={itemColor(type, mode === 'dark')} />
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: 'text.primary',
                                  fontWeight: 500,
                                }}
                              >
                                {type.replace(/-/g, ' ')}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>
                              {count}
                            </Typography>
                          </Box>
                        ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        {/* Info about scope of detection settings */}
        <Alert severity="info" sx={{ mb: 3 }}>
          These settings affect which entity types are detected during <strong>Scan</strong> and <strong>Investigation</strong> modes only. 
          <strong> Atomic Testing</strong> and <strong>Scenario Generation</strong> will always detect attack patterns and hostnames/domains regardless of these settings.
        </Alert>

        {/* Observable Types */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Observable Types</Typography>
          <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {OBSERVABLE_TYPES.map((item) => (
              <FormControlLabel
                key={item.value}
                control={
                  <Checkbox
                    size="small"
                    checked={!settings.detection?.disabledObservableTypes?.includes(item.value)}
                    onChange={(e) => {
                      const disabled = settings.detection?.disabledObservableTypes || [];
                      onUpdateSetting('detection', {
                        ...settings.detection,
                        disabledObservableTypes: e.target.checked
                          ? disabled.filter((t) => t !== item.value) // Remove from disabled = enable
                          : [...disabled, item.value], // Add to disabled = disable
                      });
                    }}
                  />
                }
                label={<Typography variant="body2">{item.label}</Typography>}
              />
            ))}
          </FormGroup>
        </Paper>

        {/* OpenCTI Types */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>OpenCTI Types</Typography>
          <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {OPENCTI_TYPES.map((item) => (
              <FormControlLabel
                key={item.value}
                control={
                  <Checkbox
                    size="small"
                    checked={!settings.detection?.disabledOpenCTITypes?.includes(item.value)}
                    onChange={(e) => {
                      const disabled = settings.detection?.disabledOpenCTITypes || [];
                      onUpdateSetting('detection', {
                        ...settings.detection,
                        disabledOpenCTITypes: e.target.checked
                          ? disabled.filter((t) => t !== item.value) // Remove from disabled = enable
                          : [...disabled, item.value], // Add to disabled = disable
                      });
                    }}
                  />
                }
                label={<Typography variant="body2">{item.label}</Typography>}
              />
            ))}
          </FormGroup>
        </Paper>

        {/* OpenAEV Types */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>OpenAEV Types</Typography>
          <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {OPENAEV_TYPES.map((item) => (
              <FormControlLabel
                key={item.value}
                control={
                  <Checkbox
                    size="small"
                    checked={!settings.detection?.disabledOpenAEVTypes?.includes(item.value)}
                    onChange={(e) => {
                      const disabled = settings.detection?.disabledOpenAEVTypes || [];
                      onUpdateSetting('detection', {
                        ...settings.detection,
                        disabledOpenAEVTypes: e.target.checked
                          ? disabled.filter((t) => t !== item.value) // Remove from disabled = enable
                          : [...disabled, item.value], // Add to disabled = disable
                      });
                    }}
                  />
                }
                label={<Typography variant="body2">{item.label}</Typography>}
              />
            ))}
          </FormGroup>
        </Paper>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<RestartAltOutlined />}
          onClick={onResetDetection}
        >
          Reset to Default
        </Button>
        <Button variant="contained" onClick={onSave}>
          Save Detection Settings
        </Button>
      </Box>
    </Box>
  );
};

export default DetectionTab;

