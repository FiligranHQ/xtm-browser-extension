/**
 * Scenario State Hook
 * 
 * Manages all state related to OpenAEV scenario creation and management.
 */

import { useState } from 'react';
import { SCENARIO_DEFAULT_VALUES } from '../../shared/types';

export interface ScenarioOverviewData {
  attackPatterns: Array<{
    id: string;
    name: string;
    externalId: string;
    description?: string;
    killChainPhases: string[];
    contracts: any[];
    entityId?: string;
    platformId?: string;
  }>;
  killChainPhases: Array<{
    phase_id: string;
    phase_kill_chain_name: string;
    phase_name: string;
    phase_order: number;
  }>;
  pageTitle?: string;
  pageUrl?: string;
  pageDescription?: string;
}

export interface ScenarioFormData {
  name: string;
  description: string;
  subtitle: string;
  category: string;
  mainFocus: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ScenarioEmail {
  attackPatternId: string;
  subject: string;
  body: string;
}

export interface SelectedInject {
  attackPatternId: string;
  attackPatternName: string;
  contractId: string;
  contractLabel: string;
  delayMinutes: number;
  // Additional fields for AI-generated injects
  title?: string;
  description?: string;
  type?: string;
  content?: string;
  executor?: string;
  subject?: string;
  body?: string;
}

export interface AIGeneratedScenario {
  name: string;
  description: string;
  subtitle?: string;
  category?: string;
  mainFocus?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  injects: Array<{
    title: string;
    description: string;
    type: string;
    content?: string;
    executor?: string;
    delayMinutes?: number;
    subject?: string;
    body?: string;
    attackPatternId?: string;
    attackPatternName?: string;
    contractId?: string;
    contractLabel?: string;
  }>;
  emails?: Array<{
    attackPatternId: string;
    subject: string;
    body: string;
  }>;
}

export interface ScenarioStateReturn {
  // Overview data
  scenarioOverviewData: ScenarioOverviewData | null;
  setScenarioOverviewData: (data: ScenarioOverviewData | null) => void;
  
  // Form data
  scenarioForm: ScenarioFormData;
  setScenarioForm: React.Dispatch<React.SetStateAction<ScenarioFormData>>;
  
  // Selected injects
  selectedInjects: SelectedInject[];
  setSelectedInjects: React.Dispatch<React.SetStateAction<SelectedInject[]>>;
  
  // Email content for table-top
  scenarioEmails: ScenarioEmail[];
  setScenarioEmails: React.Dispatch<React.SetStateAction<ScenarioEmail[]>>;
  
  // Loading and step state
  scenarioLoading: boolean;
  setScenarioLoading: (loading: boolean) => void;
  scenarioStep: 0 | 1 | 2;
  setScenarioStep: (step: 0 | 1 | 2) => void;
  
  // Affinity settings
  scenarioTypeAffinity: 'ENDPOINT' | 'CLOUD' | 'WEB' | 'TABLE-TOP';
  setScenarioTypeAffinity: (type: 'ENDPOINT' | 'CLOUD' | 'WEB' | 'TABLE-TOP') => void;
  scenarioPlatformsAffinity: string[];
  setScenarioPlatformsAffinity: React.Dispatch<React.SetStateAction<string[]>>;
  scenarioInjectSpacing: number;
  setScenarioInjectSpacing: (spacing: number) => void;
  
  // Platform selection
  scenarioPlatformSelected: boolean;
  setScenarioPlatformSelected: (selected: boolean) => void;
  scenarioPlatformId: string | null;
  setScenarioPlatformId: (id: string | null) => void;
  
  // Raw attack patterns from scan
  scenarioRawAttackPatterns: Array<{
    id: string;
    entityId?: string;
    name: string;
    externalId?: string;
    description?: string;
    killChainPhases?: string[];
    platformId?: string;
  }>;
  setScenarioRawAttackPatterns: React.Dispatch<React.SetStateAction<Array<{
    id: string;
    entityId?: string;
    name: string;
    externalId?: string;
    description?: string;
    killChainPhases?: string[];
    platformId?: string;
  }>>>;
  
  // Target selection
  scenarioTargetType: 'asset' | 'asset_group';
  setScenarioTargetType: (type: 'asset' | 'asset_group') => void;
  scenarioAssets: any[];
  setScenarioAssets: (assets: any[]) => void;
  scenarioAssetGroups: any[];
  setScenarioAssetGroups: (groups: any[]) => void;
  scenarioTeams: any[];
  setScenarioTeams: (teams: any[]) => void;
  scenarioSelectedAsset: string | null;
  setScenarioSelectedAsset: (id: string | null) => void;
  scenarioSelectedAssetGroup: string | null;
  setScenarioSelectedAssetGroup: (id: string | null) => void;
  scenarioSelectedTeam: string | null;
  setScenarioSelectedTeam: (id: string | null) => void;
  
  // AI Generation state
  scenarioCreating: boolean;
  setScenarioCreating: (creating: boolean) => void;
  scenarioAIMode: boolean;
  setScenarioAIMode: (mode: boolean) => void;
  scenarioAIGenerating: boolean;
  setScenarioAIGenerating: (generating: boolean) => void;
  scenarioAINumberOfInjects: number;
  setScenarioAINumberOfInjects: (num: number) => void;
  scenarioAIPayloadAffinity: string;
  setScenarioAIPayloadAffinity: (affinity: string) => void;
  scenarioAITableTopDuration: number;
  setScenarioAITableTopDuration: (duration: number) => void;
  scenarioAIEmailLanguage: string;
  setScenarioAIEmailLanguage: (language: string) => void;
  scenarioAITheme: string;
  setScenarioAITheme: (theme: string) => void;
  scenarioAIContext: string;
  setScenarioAIContext: (context: string) => void;
  scenarioAIGeneratedScenario: AIGeneratedScenario | null;
  setScenarioAIGeneratedScenario: (scenario: AIGeneratedScenario | null) => void;
  
  // Reset function
  resetScenarioState: () => void;
}

/**
 * Hook for managing scenario creation state
 */
export function useScenarioState(): ScenarioStateReturn {
  // Overview data
  const [scenarioOverviewData, setScenarioOverviewData] = useState<ScenarioOverviewData | null>(null);
  
  // Form data - use OpenAEV default values
  const [scenarioForm, setScenarioForm] = useState<ScenarioFormData>({
    name: '',
    description: '',
    subtitle: '',
    category: SCENARIO_DEFAULT_VALUES.category,
    mainFocus: SCENARIO_DEFAULT_VALUES.mainFocus,
    severity: SCENARIO_DEFAULT_VALUES.severity,
  });
  
  // Selected injects
  const [selectedInjects, setSelectedInjects] = useState<SelectedInject[]>([]);
  
  // Email content for table-top
  const [scenarioEmails, setScenarioEmails] = useState<ScenarioEmail[]>([]);
  
  // Loading and step state
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioStep, setScenarioStep] = useState<0 | 1 | 2>(0);
  
  // Affinity settings
  const [scenarioTypeAffinity, setScenarioTypeAffinity] = useState<'ENDPOINT' | 'CLOUD' | 'WEB' | 'TABLE-TOP'>('ENDPOINT');
  const [scenarioPlatformsAffinity, setScenarioPlatformsAffinity] = useState<string[]>(['windows', 'linux', 'macos']);
  const [scenarioInjectSpacing, setScenarioInjectSpacing] = useState<number>(1);
  
  // Platform selection
  const [scenarioPlatformSelected, setScenarioPlatformSelected] = useState(false);
  const [scenarioPlatformId, setScenarioPlatformId] = useState<string | null>(null);
  
  // Raw attack patterns from scan
  const [scenarioRawAttackPatterns, setScenarioRawAttackPatterns] = useState<Array<{
    id: string;
    entityId?: string;
    name: string;
    externalId?: string;
    description?: string;
    killChainPhases?: string[];
    platformId?: string;
  }>>([]);
  
  // Target selection
  const [scenarioTargetType, setScenarioTargetType] = useState<'asset' | 'asset_group'>('asset');
  const [scenarioAssets, setScenarioAssets] = useState<any[]>([]);
  const [scenarioAssetGroups, setScenarioAssetGroups] = useState<any[]>([]);
  const [scenarioTeams, setScenarioTeams] = useState<any[]>([]);
  const [scenarioSelectedAsset, setScenarioSelectedAsset] = useState<string | null>(null);
  const [scenarioSelectedAssetGroup, setScenarioSelectedAssetGroup] = useState<string | null>(null);
  const [scenarioSelectedTeam, setScenarioSelectedTeam] = useState<string | null>(null);
  
  // AI Generation state
  const [scenarioCreating, setScenarioCreating] = useState(false);
  const [scenarioAIMode, setScenarioAIMode] = useState(false);
  const [scenarioAIGenerating, setScenarioAIGenerating] = useState(false);
  const [scenarioAINumberOfInjects, setScenarioAINumberOfInjects] = useState<number>(5);
  const [scenarioAIPayloadAffinity, setScenarioAIPayloadAffinity] = useState<string>('powershell');
  const [scenarioAITableTopDuration, setScenarioAITableTopDuration] = useState<number>(60);
  const [scenarioAIEmailLanguage, setScenarioAIEmailLanguage] = useState<string>('english');
  const [scenarioAITheme, setScenarioAITheme] = useState<string>('cybersecurity');
  const [scenarioAIContext, setScenarioAIContext] = useState<string>('');
  const [scenarioAIGeneratedScenario, setScenarioAIGeneratedScenario] = useState<AIGeneratedScenario | null>(null);
  
  // Reset function
  const resetScenarioState = () => {
    setScenarioForm({
      name: '',
      description: '',
      subtitle: '',
      category: SCENARIO_DEFAULT_VALUES.category,
      mainFocus: SCENARIO_DEFAULT_VALUES.mainFocus,
      severity: SCENARIO_DEFAULT_VALUES.severity,
    });
    setSelectedInjects([]);
    setScenarioEmails([]);
    setScenarioLoading(false);
    setScenarioStep(0);
    setScenarioTypeAffinity('ENDPOINT');
    setScenarioPlatformsAffinity(['windows', 'linux', 'macos']);
    setScenarioInjectSpacing(1);
    setScenarioPlatformSelected(false);
    setScenarioPlatformId(null);
    setScenarioRawAttackPatterns([]);
    setScenarioTargetType('asset');
    setScenarioAssets([]);
    setScenarioAssetGroups([]);
    setScenarioTeams([]);
    setScenarioSelectedAsset(null);
    setScenarioSelectedAssetGroup(null);
    setScenarioSelectedTeam(null);
    setScenarioCreating(false);
    setScenarioAIMode(false);
    setScenarioAIGenerating(false);
    setScenarioAINumberOfInjects(5);
    setScenarioAIPayloadAffinity('powershell');
    setScenarioAITableTopDuration(60);
    setScenarioAIEmailLanguage('english');
    setScenarioAITheme('cybersecurity');
    setScenarioAIContext('');
    setScenarioAIGeneratedScenario(null);
    setScenarioOverviewData(null);
  };
  
  return {
    scenarioOverviewData,
    setScenarioOverviewData,
    scenarioForm,
    setScenarioForm,
    selectedInjects,
    setSelectedInjects,
    scenarioEmails,
    setScenarioEmails,
    scenarioLoading,
    setScenarioLoading,
    scenarioStep,
    setScenarioStep,
    scenarioTypeAffinity,
    setScenarioTypeAffinity,
    scenarioPlatformsAffinity,
    setScenarioPlatformsAffinity,
    scenarioInjectSpacing,
    setScenarioInjectSpacing,
    scenarioPlatformSelected,
    setScenarioPlatformSelected,
    scenarioPlatformId,
    setScenarioPlatformId,
    scenarioRawAttackPatterns,
    setScenarioRawAttackPatterns,
    scenarioTargetType,
    setScenarioTargetType,
    scenarioAssets,
    setScenarioAssets,
    scenarioAssetGroups,
    setScenarioAssetGroups,
    scenarioTeams,
    setScenarioTeams,
    scenarioSelectedAsset,
    setScenarioSelectedAsset,
    scenarioSelectedAssetGroup,
    setScenarioSelectedAssetGroup,
    scenarioSelectedTeam,
    setScenarioSelectedTeam,
    scenarioCreating,
    setScenarioCreating,
    scenarioAIMode,
    setScenarioAIMode,
    scenarioAIGenerating,
    setScenarioAIGenerating,
    scenarioAINumberOfInjects,
    setScenarioAINumberOfInjects,
    scenarioAIPayloadAffinity,
    setScenarioAIPayloadAffinity,
    scenarioAITableTopDuration,
    setScenarioAITableTopDuration,
    scenarioAIEmailLanguage,
    setScenarioAIEmailLanguage,
    scenarioAITheme,
    setScenarioAITheme,
    scenarioAIContext,
    setScenarioAIContext,
    scenarioAIGeneratedScenario,
    setScenarioAIGeneratedScenario,
    resetScenarioState,
  };
}

