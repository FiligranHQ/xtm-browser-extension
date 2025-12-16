/**
 * AI State Hook
 * 
 * Manages all AI-related state for the panel.
 * Extracted from App.tsx to reduce file size.
 */

import { useState } from 'react';

export interface AISettings {
  enabled: boolean;
  provider?: string;
  available: boolean;
}

export interface ResolvedRelationship {
  fromIndex: number;
  toIndex: number;
  relationshipType: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  excerpt?: string;
}

export interface AIStateReturn {
  // AI Configuration
  aiSettings: AISettings;
  setAiSettings: React.Dispatch<React.SetStateAction<AISettings>>;
  
  // AI Generation states
  aiGeneratingDescription: boolean;
  setAiGeneratingDescription: (generating: boolean) => void;
  aiSelectingInjects: boolean;
  setAiSelectingInjects: (selecting: boolean) => void;
  aiFillingEmails: boolean;
  setAiFillingEmails: (filling: boolean) => void;
  aiDiscoveringEntities: boolean;
  setAiDiscoveringEntities: (discovering: boolean) => void;
  aiResolvingRelationships: boolean;
  setAiResolvingRelationships: (resolving: boolean) => void;
  
  // Resolved relationships
  resolvedRelationships: ResolvedRelationship[];
  setResolvedRelationships: React.Dispatch<React.SetStateAction<ResolvedRelationship[]>>;
  
  // Page content for AI discovery
  scanPageContent: string;
  setScanPageContent: (content: string) => void;
}

/**
 * Hook for managing AI-related state
 */
export function useAIState(): AIStateReturn {
  // AI Configuration
  const [aiSettings, setAiSettings] = useState<AISettings>({ 
    enabled: false, 
    available: false 
  });
  
  // AI Generation states
  const [aiGeneratingDescription, setAiGeneratingDescription] = useState(false);
  const [aiSelectingInjects, setAiSelectingInjects] = useState(false);
  const [aiFillingEmails, setAiFillingEmails] = useState(false);
  const [aiDiscoveringEntities, setAiDiscoveringEntities] = useState(false);
  const [aiResolvingRelationships, setAiResolvingRelationships] = useState(false);
  
  // Resolved relationships
  const [resolvedRelationships, setResolvedRelationships] = useState<ResolvedRelationship[]>([]);
  
  // Page content for AI discovery
  const [scanPageContent, setScanPageContent] = useState<string>('');
  
  return {
    aiSettings,
    setAiSettings,
    aiGeneratingDescription,
    setAiGeneratingDescription,
    aiSelectingInjects,
    setAiSelectingInjects,
    aiFillingEmails,
    setAiFillingEmails,
    aiDiscoveringEntities,
    setAiDiscoveringEntities,
    aiResolvingRelationships,
    setAiResolvingRelationships,
    resolvedRelationships,
    setResolvedRelationships,
    scanPageContent,
    setScanPageContent,
  };
}

