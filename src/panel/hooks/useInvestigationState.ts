/**
 * Investigation State Hook
 * 
 * Manages all state related to OpenCTI investigation mode.
 */

import { useState, useMemo } from 'react';
import type { InvestigationEntity } from '../types/panel-types';

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
  
  // Search query
  investigationSearchQuery: string;
  setInvestigationSearchQuery: (query: string) => void;
  
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
  
  // Search query
  const [investigationSearchQuery, setInvestigationSearchQuery] = useState<string>('');
  
  // Platform selection
  const [investigationPlatformSelected, setInvestigationPlatformSelected] = useState(false);
  const [investigationPlatformId, setInvestigationPlatformId] = useState<string | null>(null);
  
  // Get unique entity types for filter
  const investigationEntityTypes = useMemo(() => {
    const types = new Set(investigationEntities.map(e => e.type));
    return Array.from(types).sort();
  }, [investigationEntities]);
  
  // Filter investigation entities by type and search query
  const filteredInvestigationEntities = useMemo(() => {
    let filtered = investigationEntities;
    
    // Filter by type
    if (investigationTypeFilter !== 'all') {
      filtered = filtered.filter(e => e.type === investigationTypeFilter);
    }
    
    // Filter by search query
    if (investigationSearchQuery.trim()) {
      const query = investigationSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(e => {
        const name = (e.name || '').toLowerCase();
        const value = (e.value || '').toLowerCase();
        return name.includes(query) || value.includes(query);
      });
    }
    
    return filtered;
  }, [investigationEntities, investigationTypeFilter, investigationSearchQuery]);
  
  // Count selected entities
  const selectedInvestigationCount = useMemo(() => {
    return investigationEntities.filter(e => e.selected).length;
  }, [investigationEntities]);
  
  // Reset function
  const resetInvestigationState = () => {
    setInvestigationEntities([]);
    setInvestigationScanning(false);
    setInvestigationTypeFilter('all');
    setInvestigationSearchQuery('');
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
    investigationSearchQuery,
    setInvestigationSearchQuery,
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
