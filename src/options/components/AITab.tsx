/**
 * AI Tab Component
 *
 * Configures the XTM One endpoint used by every AI feature in the extension.
 * There is no BYOK mode — XTM One is the sole AI backend.
 */
import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesomeOutlined,
  CenterFocusStrongOutlined,
  CheckOutlined,
  DescriptionOutlined,
  HubOutlined,
  InfoOutlined,
  KeyOutlined,
  LinkOutlined,
  MovieFilterOutlined,
  TravelExploreOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from '@mui/icons-material';
import type { ExtensionSettings } from '../../shared/types/settings';
import { AI_DEFAULTS } from '../../shared/types/ai';
import type { AITestResult } from '../constants';

interface AITabProps {
  settings: ExtensionSettings;
  aiTesting: boolean;
  aiTestResult: AITestResult | null;
  onUpdateSetting: <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => void;
  onTestConnection: () => void;
  onSave: () => void;
  setAiTestResult: (result: AITestResult | null) => void;
}

/** Derive the "Get API Token" deep link once the user has supplied an XTM One URL. */
function getApiTokenUrl(xtmOneUrl: string | undefined): string | null {
  if (!xtmOneUrl) return null;
  const trimmed = xtmOneUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return `${trimmed}/profile/api-keys`;
  } catch {
    return null;
  }
}

const AITab: React.FC<AITabProps> = ({
  settings,
  aiTesting,
  aiTestResult,
  onUpdateSetting,
  onTestConnection,
  onSave,
  setAiTestResult,
}) => {
  const hasEnterpriseEdition = [
    ...(settings?.openctiPlatforms || []),
    ...(settings?.openaevPlatforms || []),
  ].some((p: { isEnterprise?: boolean }) => p.isEnterprise);

  const xtmOneUrl = settings?.ai?.xtmOneUrl || '';
  const apiToken = settings?.ai?.apiToken || '';
  const apiTokenUrl = getApiTokenUrl(xtmOneUrl);
  const canTest = Boolean(xtmOneUrl.trim()) && Boolean(apiToken.trim()) && !aiTesting;
  const [showToken, setShowToken] = React.useState(false);

  const updateAi = (patch: Partial<NonNullable<ExtensionSettings['ai']>>) => {
    setAiTestResult(null);
    onUpdateSetting('ai', {
      ...settings?.ai,
      ...patch,
      connectionTested: false,
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>XTM One</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Configure XTM One — Filigran's agentic AI platform — to power intelligent content generation and scenario creation.
      </Typography>

      {!hasEnterpriseEdition ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          AI features require at least one Enterprise Edition (EE) platform.
          Connect an EE platform to enable AI capabilities.
        </Alert>
      ) : (
        <Box sx={{ flex: 1 }}>
          {/* XTM One configuration */}
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1, mb: 3 }}>
            <TextField
              fullWidth
              label="XTM One URL"
              placeholder="https://xtm.company.com"
              value={xtmOneUrl}
              onChange={(e) => updateAi({ xtmOneUrl: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkOutlined sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              helperText="Enter the base URL of your XTM One instance (e.g. https://xtm.company.com)"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                type={showToken ? 'text' : 'password'}
                label="XTM One API Token"
                placeholder="fcp-..."
                value={apiToken}
                onChange={(e) => updateAi({ apiToken: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyOutlined sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowToken(!showToken)} edge="end" size="small">
                        {showToken ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText={
                  apiTokenUrl ? (
                    <>
                      Generate a Personal Access Token from your{' '}
                      <Link href={apiTokenUrl} target="_blank" rel="noopener noreferrer">
                        XTM One profile
                      </Link>
                      . Tokens start with <code>fcp-</code>.
                    </>
                  ) : (
                    'Enter your XTM One URL above to get a direct link to the token page.'
                  )
                }
              />
            </Box>

            {aiTestResult && (
              <Alert
                severity={aiTestResult.success ? 'success' : 'error'}
                sx={{ mt: 2, borderRadius: 1, py: 0 }}
                onClose={() => setAiTestResult(null)}
              >
                {aiTestResult.message}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button
                size="small"
                variant="outlined"
                disabled={!canTest}
                onClick={onTestConnection}
                startIcon={aiTesting ? <CircularProgress size={14} /> : <CheckOutlined />}
              >
                {aiTesting ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={onSave}
                disabled={!xtmOneUrl.trim() || !apiToken.trim()}
              >
                Save
              </Button>
            </Box>
          </Paper>

          {/* Advanced Settings */}
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Advanced Settings</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Tune the request size limits forwarded to XTM One.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                type="number"
                label="Max Output Tokens"
                value={settings?.ai?.maxTokens ?? AI_DEFAULTS.maxTokens}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value > 0) {
                    onUpdateSetting('ai', { ...settings?.ai, maxTokens: value });
                  }
                }}
                helperText="Maximum tokens for AI response (default: 10,000)"
                inputProps={{ min: 1000, max: 100000, step: 1000 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Caps the length of AI-generated responses. Increase if responses are being cut off; decrease to save tokens and speed up replies.">
                        <InfoOutlined sx={{ fontSize: 18, color: 'text.secondary', cursor: 'help' }} />
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                type="number"
                label="Max Content Length"
                value={settings?.ai?.maxContentLength ?? AI_DEFAULTS.maxContentLength}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value > 0) {
                    onUpdateSetting('ai', { ...settings?.ai, maxContentLength: value });
                  }
                }}
                helperText="Maximum page content in characters (default: 50,000)"
                inputProps={{ min: 1000, max: 200000, step: 1000 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Limits how much page content is sent to XTM One. Large pages are truncated to this value to avoid exceeding API limits and wasting tokens on irrelevant content.">
                        <InfoOutlined sx={{ fontSize: 18, color: 'text.secondary', cursor: 'help' }} />
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Button
              size="small"
              variant="contained"
              onClick={onSave}
              sx={{ mt: 2 }}
            >
              Save
            </Button>
          </Paper>

          {/* Capabilities */}
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>AI Capabilities</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Once XTM One is configured, the following features are powered by dedicated agents:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <DescriptionOutlined sx={{ color: '#4fc3f7', mt: 0.3 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Container Description</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Generate intelligent descriptions when creating containers in OpenCTI
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <MovieFilterOutlined sx={{ color: '#ab47bc', mt: 0.3 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Full Scenario Generation</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Generate complete OpenAEV scenarios with AI-created injects, payloads, or emails based on page content
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <AutoAwesomeOutlined sx={{ color: '#ff9800', mt: 0.3 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Email Content Generation</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Generate realistic email subjects and bodies for table-top scenarios
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <CenterFocusStrongOutlined sx={{ color: '#f44336', mt: 0.3 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>On-the-fly Atomic Testing</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Generate custom atomic tests with executable commands for attack patterns
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <TravelExploreOutlined sx={{ color: '#4caf50', mt: 0.3 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Smart Entity Discovery</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Discover additional entities that regex patterns might miss during page scans
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <HubOutlined sx={{ color: '#e91e63', mt: 0.3 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Relationship Resolution</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Automatically suggest STIX relationships between entities based on page context
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default AITab;
