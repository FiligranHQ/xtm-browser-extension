/**
 * Atomic Testing State Hook
 * 
 * Manages all state related to OpenAEV atomic testing creation.
 */

import { useState } from 'react';
import type { AtomicTestingTarget, AIGeneratedPayload } from '../types/panel-types';
import type { OAEVAsset, OAEVAssetGroup, OAEVInjectorContract } from '../../shared/types/openaev';

export type { AtomicTestingTarget, AIGeneratedPayload };

export interface AtomicTestingStateReturn {
  // Targets from page scan
  atomicTestingTargets: AtomicTestingTarget[];
  setAtomicTestingTargets: React.Dispatch<React.SetStateAction<AtomicTestingTarget[]>>;
  
  // Selected target
  selectedAtomicTarget: AtomicTestingTarget | null;
  setSelectedAtomicTarget: (target: AtomicTestingTarget | null) => void;
  
  // UI state
  atomicTestingShowList: boolean;
  setAtomicTestingShowList: (show: boolean) => void;
  
  // Platform selection
  atomicTestingPlatformId: string | null;
  setAtomicTestingPlatformId: (id: string | null) => void;
  atomicTestingPlatformSelected: boolean;
  setAtomicTestingPlatformSelected: (selected: boolean) => void;
  
  // Target type selection
  atomicTestingTargetType: 'asset' | 'asset_group';
  setAtomicTestingTargetType: (type: 'asset' | 'asset_group') => void;
  
  // Assets and asset groups
  atomicTestingAssets: OAEVAsset[];
  setAtomicTestingAssets: (assets: OAEVAsset[]) => void;
  atomicTestingAssetGroups: OAEVAssetGroup[];
  setAtomicTestingAssetGroups: (groups: OAEVAssetGroup[]) => void;
  
  // Type filter
  atomicTestingTypeFilter: 'all' | 'attack-pattern' | 'domain';
  setAtomicTestingTypeFilter: (filter: 'all' | 'attack-pattern' | 'domain') => void;
  
  // Injector contracts
  atomicTestingInjectorContracts: OAEVInjectorContract[];
  setAtomicTestingInjectorContracts: (contracts: OAEVInjectorContract[]) => void;
  
  // Selections
  atomicTestingSelectedAsset: string | null;
  setAtomicTestingSelectedAsset: (id: string | null) => void;
  atomicTestingSelectedAssetGroup: string | null;
  setAtomicTestingSelectedAssetGroup: (id: string | null) => void;
  atomicTestingSelectedContract: string | null;
  setAtomicTestingSelectedContract: (id: string | null) => void;
  
  // Form fields
  atomicTestingTitle: string;
  setAtomicTestingTitle: (title: string) => void;
  
  // Loading states
  atomicTestingCreating: boolean;
  setAtomicTestingCreating: (creating: boolean) => void;
  atomicTestingLoadingAssets: boolean;
  setAtomicTestingLoadingAssets: (loading: boolean) => void;
  
  // AI Payload Generation
  atomicTestingAIMode: boolean;
  setAtomicTestingAIMode: (mode: boolean) => void;
  atomicTestingAIGenerating: boolean;
  setAtomicTestingAIGenerating: (generating: boolean) => void;
  atomicTestingAIPlatform: string;
  setAtomicTestingAIPlatform: (platform: string) => void;
  atomicTestingAIExecutor: string;
  setAtomicTestingAIExecutor: (executor: string) => void;
  atomicTestingAIContext: string;
  setAtomicTestingAIContext: (context: string) => void;
  atomicTestingAIGeneratedPayload: AIGeneratedPayload | null;
  setAtomicTestingAIGeneratedPayload: (payload: AIGeneratedPayload | null) => void;
  
  // Reset function
  resetAtomicTestingState: () => void;
}

/**
 * Hook for managing atomic testing state
 */
export function useAtomicTestingState(): AtomicTestingStateReturn {
  // Targets from page scan
  const [atomicTestingTargets, setAtomicTestingTargets] = useState<AtomicTestingTarget[]>([]);
  
  // Selected target
  const [selectedAtomicTarget, setSelectedAtomicTarget] = useState<AtomicTestingTarget | null>(null);
  
  // UI state
  const [atomicTestingShowList, setAtomicTestingShowList] = useState(true);
  
  // Platform selection
  const [atomicTestingPlatformId, setAtomicTestingPlatformId] = useState<string | null>(null);
  const [atomicTestingPlatformSelected, setAtomicTestingPlatformSelected] = useState(false);
  
  // Target type selection
  const [atomicTestingTargetType, setAtomicTestingTargetType] = useState<'asset' | 'asset_group'>('asset');
  
  // Assets and asset groups
  const [atomicTestingAssets, setAtomicTestingAssets] = useState<OAEVAsset[]>([]);
  const [atomicTestingAssetGroups, setAtomicTestingAssetGroups] = useState<OAEVAssetGroup[]>([]);
  
  // Type filter
  const [atomicTestingTypeFilter, setAtomicTestingTypeFilter] = useState<'all' | 'attack-pattern' | 'domain'>('all');
  
  // Injector contracts
  const [atomicTestingInjectorContracts, setAtomicTestingInjectorContracts] = useState<OAEVInjectorContract[]>([]);
  
  // Selections
  const [atomicTestingSelectedAsset, setAtomicTestingSelectedAsset] = useState<string | null>(null);
  const [atomicTestingSelectedAssetGroup, setAtomicTestingSelectedAssetGroup] = useState<string | null>(null);
  const [atomicTestingSelectedContract, setAtomicTestingSelectedContract] = useState<string | null>(null);
  
  // Form fields
  const [atomicTestingTitle, setAtomicTestingTitle] = useState('');
  
  // Loading states
  const [atomicTestingCreating, setAtomicTestingCreating] = useState(false);
  const [atomicTestingLoadingAssets, setAtomicTestingLoadingAssets] = useState(false);
  
  // AI Payload Generation
  const [atomicTestingAIMode, setAtomicTestingAIMode] = useState(false);
  const [atomicTestingAIGenerating, setAtomicTestingAIGenerating] = useState(false);
  const [atomicTestingAIPlatform, setAtomicTestingAIPlatform] = useState('Windows');
  const [atomicTestingAIExecutor, setAtomicTestingAIExecutor] = useState('psh');
  const [atomicTestingAIContext, setAtomicTestingAIContext] = useState('');
  const [atomicTestingAIGeneratedPayload, setAtomicTestingAIGeneratedPayload] = useState<AIGeneratedPayload | null>(null);
  
  // Reset function
  const resetAtomicTestingState = () => {
    setAtomicTestingTargets([]);
    setSelectedAtomicTarget(null);
    setAtomicTestingShowList(true);
    setAtomicTestingPlatformId(null);
    setAtomicTestingPlatformSelected(false);
    setAtomicTestingTargetType('asset');
    setAtomicTestingAssets([]);
    setAtomicTestingAssetGroups([]);
    setAtomicTestingTypeFilter('all');
    setAtomicTestingInjectorContracts([]);
    setAtomicTestingSelectedAsset(null);
    setAtomicTestingSelectedAssetGroup(null);
    setAtomicTestingSelectedContract(null);
    setAtomicTestingTitle('');
    setAtomicTestingCreating(false);
    setAtomicTestingLoadingAssets(false);
    setAtomicTestingAIMode(false);
    setAtomicTestingAIGenerating(false);
    setAtomicTestingAIPlatform('Windows');
    setAtomicTestingAIExecutor('psh');
    setAtomicTestingAIContext('');
    setAtomicTestingAIGeneratedPayload(null);
  };
  
  return {
    atomicTestingTargets,
    setAtomicTestingTargets,
    selectedAtomicTarget,
    setSelectedAtomicTarget,
    atomicTestingShowList,
    setAtomicTestingShowList,
    atomicTestingPlatformId,
    setAtomicTestingPlatformId,
    atomicTestingPlatformSelected,
    setAtomicTestingPlatformSelected,
    atomicTestingTargetType,
    setAtomicTestingTargetType,
    atomicTestingAssets,
    setAtomicTestingAssets,
    atomicTestingAssetGroups,
    setAtomicTestingAssetGroups,
    atomicTestingTypeFilter,
    setAtomicTestingTypeFilter,
    atomicTestingInjectorContracts,
    setAtomicTestingInjectorContracts,
    atomicTestingSelectedAsset,
    setAtomicTestingSelectedAsset,
    atomicTestingSelectedAssetGroup,
    setAtomicTestingSelectedAssetGroup,
    atomicTestingSelectedContract,
    setAtomicTestingSelectedContract,
    atomicTestingTitle,
    setAtomicTestingTitle,
    atomicTestingCreating,
    setAtomicTestingCreating,
    atomicTestingLoadingAssets,
    setAtomicTestingLoadingAssets,
    atomicTestingAIMode,
    setAtomicTestingAIMode,
    atomicTestingAIGenerating,
    setAtomicTestingAIGenerating,
    atomicTestingAIPlatform,
    setAtomicTestingAIPlatform,
    atomicTestingAIExecutor,
    setAtomicTestingAIExecutor,
    atomicTestingAIContext,
    setAtomicTestingAIContext,
    atomicTestingAIGeneratedPayload,
    setAtomicTestingAIGeneratedPayload,
    resetAtomicTestingState,
  };
}
