/**
 * AI Tab Component
 * Configuration for Agentic AI features
 */
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  CheckOutlined,
  KeyOutlined,
  LinkOffOutlined,
  DescriptionOutlined,
  MovieFilterOutlined,
  AutoAwesomeOutlined,
  CenterFocusStrongOutlined,
  TravelExploreOutlined,
  HubOutlined,
} from '@mui/icons-material';
import type { ExtensionSettings, AIProvider } from '../../shared/types';
import type { AITestResult, AvailableModel } from '../constants';

interface AITabProps {
  settings: ExtensionSettings;
  mode: 'dark' | 'light';
  aiTesting: boolean;
  aiTestResult: AITestResult | null;
  availableModels: AvailableModel[];
  onUpdateSetting: <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => void;
  onTestAndFetchModels: () => void;
  onClearAI: () => void;
  onSave: () => void;
  setAiTestResult: (result: AITestResult | null) => void;
  setAvailableModels: (models: AvailableModel[]) => void;
}

const AITab: React.FC<AITabProps> = ({
  settings,
  mode,
  aiTesting,
  aiTestResult,
  availableModels,
  onUpdateSetting,
  onTestAndFetchModels,
  onClearAI,
  onSave,
  setAiTestResult,
  setAvailableModels,
}) => {
  const hasEnterpriseEdition = [
    ...(settings?.openctiPlatforms || []),
    ...(settings?.openaevPlatforms || []),
  ].some((p: any) => p.isEnterprise);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Agentic AI</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Configure AI-powered features for intelligent content generation and scenario creation
      </Typography>

      {/* Check if any platform has EE */}
      {!hasEnterpriseEdition ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          AI features require at least one Enterprise Edition (EE) platform. 
          Connect an EE platform to enable AI capabilities.
        </Alert>
      ) : (
        <Box sx={{ flex: 1 }}>
          {/* XTM One Section - Coming Soon */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              bgcolor: 'background.paper', 
              borderRadius: 1, 
              mb: 3,
              border: '1px solid',
              borderColor: 'divider',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ 
              position: 'absolute', 
              top: 0, 
              right: 0, 
              bgcolor: 'warning.main', 
              color: 'warning.contrastText',
              px: 2,
              py: 0.5,
              borderBottomLeftRadius: 8,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              COMING SOON
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <img 
                src={`../assets/logos/logo_xtm-one_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
                alt="XTM One" 
                width={48} 
                height={48}
                style={{ opacity: 0.7 }}
              />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  XTM One
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  Filigran Agentic AI Platform
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="body2" sx={{ color: 'text.disabled', mb: 2 }}>
              XTM One is Filigran's upcoming agentic AI platform that will provide advanced threat intelligence analysis, 
              automated scenario generation, and intelligent security recommendations powered by cutting-edge AI technology.
            </Typography>
            
            <Box sx={{ 
              display: 'flex', 
              gap: 1, 
              flexWrap: 'wrap',
              opacity: 0.6,
            }}>
              {['Agentic Workflows', 'Auto-Investigation', 'Smart Enrichment', 'Threat Prediction'].map((feature) => (
                <Chip 
                  key={feature}
                  label={feature} 
                  size="small" 
                  sx={{ 
                    bgcolor: 'action.disabledBackground',
                    color: 'text.disabled',
                  }}
                />
              ))}
            </Box>
          </Paper>

          {/* BYOK (Bring Your Own Key) Section */}
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Bring Your Own LLM</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Connect your own LLM provider to enable AI features. Select a provider, enter your API key, and choose your preferred model.
            </Typography>

            {/* Provider Selection */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              {[
                { value: 'openai', label: 'OpenAI', sublabel: 'GPT' },
                { value: 'anthropic', label: 'Anthropic', sublabel: 'Claude' },
                { value: 'gemini', label: 'Google', sublabel: 'Gemini' },
              ].map((provider) => (
                <Paper
                  key={provider.value}
                  onClick={() => {
                    // Reset test results and models when switching providers
                    setAiTestResult(null);
                    setAvailableModels([]);
                    onUpdateSetting('ai', { 
                      enabled: false,
                      provider: provider.value as AIProvider,
                      model: undefined,
                      availableModels: undefined,
                      connectionTested: false,
                      apiKey: settings?.ai?.apiKey,
                    });
                  }}
                  sx={{
                    p: 2,
                    minWidth: 140,
                    cursor: 'pointer',
                    border: settings?.ai?.provider === provider.value ? '2px solid' : '1px solid',
                    borderColor: settings?.ai?.provider === provider.value ? 'primary.main' : 'divider',
                    bgcolor: settings?.ai?.provider === provider.value ? 'action.selected' : 'background.paper',
                    borderRadius: 1,
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {provider.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {provider.sublabel}
                  </Typography>
                </Paper>
              ))}
            </Box>

            {/* API Key Input with Test Button */}
            {settings?.ai?.provider && settings.ai.provider !== 'xtm-one' && (
              <>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField
                    fullWidth
                    type="password"
                    label={`${settings.ai.provider === 'openai' ? 'OpenAI' : settings.ai.provider === 'anthropic' ? 'Anthropic' : 'Google'} API Key`}
                    placeholder={`Enter your ${settings.ai.provider === 'openai' ? 'OpenAI' : settings.ai.provider === 'anthropic' ? 'Anthropic' : 'Google'} API key`}
                    value={settings?.ai?.apiKey || ''}
                    onChange={(e) => {
                      // Reset test results when API key changes
                      setAiTestResult(null);
                      setAvailableModels([]);
                      onUpdateSetting('ai', { 
                        ...settings?.ai,
                        enabled: false,
                        apiKey: e.target.value,
                        model: undefined,
                        availableModels: undefined,
                        connectionTested: false,
                      });
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <KeyOutlined sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                    helperText={
                      settings.ai.provider === 'openai' 
                        ? 'Get your API key from platform.openai.com' 
                        : settings.ai.provider === 'anthropic'
                        ? 'Get your API key from console.anthropic.com'
                        : 'Get your API key from aistudio.google.com'
                    }
                  />
                  <Button
                    variant="outlined"
                    disabled={!settings?.ai?.apiKey || aiTesting}
                    onClick={onTestAndFetchModels}
                    sx={{ 
                      minWidth: 150,
                      height: 56,
                    }}
                  >
                    {aiTesting ? (
                      <CircularProgress size={20} />
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                </Box>

                {/* Test Result Alert */}
                {aiTestResult && (
                  <Alert 
                    severity={aiTestResult.success ? 'success' : 'error'} 
                    sx={{ mb: 2 }}
                    onClose={() => setAiTestResult(null)}
                  >
                    {aiTestResult.message}
                  </Alert>
                )}

                {/* Model Selection */}
                {(availableModels.length > 0 || settings?.ai?.availableModels?.length) && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Model</InputLabel>
                    <Select
                      value={settings?.ai?.model || ''}
                      label="Model"
                      onChange={(e) => onUpdateSetting('ai', {
                        enabled: settings?.ai?.enabled ?? false,
                        provider: settings?.ai?.provider,
                        apiKey: settings?.ai?.apiKey,
                        model: e.target.value,
                        availableModels: settings?.ai?.availableModels,
                        connectionTested: settings?.ai?.connectionTested,
                      })}
                    >
                      {(availableModels.length > 0 ? availableModels : (settings?.ai?.availableModels || [])).map((model) => (
                        <MenuItem key={model.id} value={model.id}>
                          <Box>
                            <Typography variant="body2">{model.name}</Typography>
                            {model.description && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {model.description}
                              </Typography>
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Enable/Disable Toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings?.ai?.enabled && !!settings?.ai?.apiKey && !!settings?.ai?.model}
                      onChange={(e) => onUpdateSetting('ai', { 
                        ...settings?.ai, 
                        enabled: e.target.checked,
                      })}
                      disabled={!settings?.ai?.apiKey || !settings?.ai?.model}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">Enable AI Features</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {!settings?.ai?.apiKey 
                          ? 'Enter an API key and test connection first'
                          : !settings?.ai?.model
                            ? 'Select a model to enable AI features'
                            : settings?.ai?.enabled 
                              ? 'AI features are active' 
                              : 'AI features are disabled'}
                      </Typography>
                    </Box>
                  }
                />
              </>
            )}

            {/* Clear AI Configuration */}
            {settings?.ai?.provider && (
              <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<LinkOffOutlined />}
                  onClick={onClearAI}
                  fullWidth
                >
                  Clear AI Configuration
                </Button>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, textAlign: 'center' }}>
                  Remove API key and disable all AI features
                </Typography>
              </Box>
            )}
          </Paper>

          {/* AI Capabilities Info */}
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>AI Capabilities</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              When enabled, AI powers the following features:
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

      {/* Save Button */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<CheckOutlined />}
          onClick={onSave}
          disabled={!hasEnterpriseEdition}
        >
          Save AI Settings
        </Button>
      </Box>
    </Box>
  );
};

export default AITab;

