/**
 * Investigation State Hook
 * 
 * Manages all state related to OpenCTI investigation mode.
 */

import { useState, useMemo } from 'react';
import type { InvestigationEntity } from '../types';

export type { InvestigationEntity };

export interface InvestigationStateReturn {
  // Entities found
  investigationEntities: InvestigationEntity[];
  setInvestigationEntities: React.Dispatch<React.SetStateAction<InvestigationEntity[]>>;
  
  // Scanning state
  investigationScanning: boolean;
  setInvestigationScanning: (scanning: boolean) => void;
  
  // Type filter
  investigationTypeFilter: string;
  setInvestigationTypeFilter: (filter: string) => void;
  
  // Platform selection
  investigationPlatformSelected: boolean;
  setInvestigationPlatformSelected: (selected: boolean) => void;
  investigationPlatformId: string | null;
  setInvestigationPlatformId: (id: string | null) => void;
  
  // Computed values
  investigationEntityTypes: string[];
  filteredInvestigationEntities: InvestigationEntity[];
  selectedInvestigationCount: number;
  
  // Reset function
  resetInvestigationState: () => void;
}

/**
 * Hook for managing investigation state
 */
export function useInvestigationState(): InvestigationStateReturn {
  // Entities found
  const [investigationEntities, setInvestigationEntities] = useState<InvestigationEntity[]>([]);
  
  // Scanning state
  const [investigationScanning, setInvestigationScanning] = useState(false);
  
  // Type filter
  const [investigationTypeFilter, setInvestigationTypeFilter] = useState<string>('all');
  
  // Platform selection
  const [investigationPlatformSelected, setInvestigationPlatformSelected] = useState(false);
  const [investigationPlatformId, setInvestigationPlatformId] = useState<string | null>(null);
  
  // Get unique entity types for filter
  const investigationEntityTypes = useMemo(() => {
    const types = new Set(investigationEntities.map(e => e.type));
    return Array.from(types).sort();
  }, [investigationEntities]);
  
  // Filter investigation entities by type
  const filteredInvestigationEntities = useMemo(() => {
    if (investigationTypeFilter === 'all') return investigationEntities;
    return investigationEntities.filter(e => e.type === investigationTypeFilter);
  }, [investigationEntities, investigationTypeFilter]);
  
  // Count selected entities
  const selectedInvestigationCount = useMemo(() => {
    return investigationEntities.filter(e => e.selected).length;
  }, [investigationEntities]);
  
  // Reset function
  const resetInvestigationState = () => {
    setInvestigationEntities([]);
    setInvestigationScanning(false);
    setInvestigationTypeFilter('all');
    setInvestigationPlatformSelected(false);
    setInvestigationPlatformId(null);
  };
  
  return {
    investigationEntities,
    setInvestigationEntities,
    investigationScanning,
    setInvestigationScanning,
    investigationTypeFilter,
    setInvestigationTypeFilter,
    investigationPlatformSelected,
    setInvestigationPlatformSelected,
    investigationPlatformId,
    setInvestigationPlatformId,
    investigationEntityTypes,
    filteredInvestigationEntities,
    selectedInvestigationCount,
    resetInvestigationState,
  };
}
