/**
 * Investigation Handler
 * 
 * Handles processing of investigation data.
 * Extracts pure data transformation logic from App.tsx.
 */

/**
 * Raw entity data from investigation scan results
 */
export interface RawInvestigationEntity {
  entityId?: string;
  id?: string;
  type?: string;
  entity_type?: string;
  name?: string;
  value?: string;
  platformId?: string;
}

/**
 * Processed investigation entity for display
 */
export interface InvestigationEntity {
  id: string;
  type: string;
  name: string;
  value: string | undefined;
  platformId: string | undefined;
  selected: boolean;
}

/**
 * Payload for investigation results
 */
export interface InvestigationResultsPayload {
  entities?: RawInvestigationEntity[];
}

/**
 * Process investigation results payload and return normalized entities
 */
export function processInvestigationResults(
  payload: InvestigationResultsPayload
): InvestigationEntity[] {
  const rawEntities = payload?.entities || [];

  return rawEntities.map((entity: RawInvestigationEntity) => ({
    id: entity.entityId || entity.id || '',
    type: entity.type || entity.entity_type || '',
    name: entity.name || entity.value || '',
    value: entity.value,
    platformId: entity.platformId,
    selected: false,
  }));
}

/**
 * Toggle selection for a single investigation entity
 */
export function toggleInvestigationEntitySelection(
  entities: InvestigationEntity[],
  entityId: string,
  selected: boolean
): InvestigationEntity[] {
  return entities.map(entity =>
    entity.id === entityId ? { ...entity, selected } : entity
  );
}

/**
 * Select all investigation entities
 */
export function selectAllInvestigationEntities(
  entities: InvestigationEntity[]
): InvestigationEntity[] {
  return entities.map(entity => ({ ...entity, selected: true }));
}

/**
 * Deselect all investigation entities
 */
export function deselectAllInvestigationEntities(
  entities: InvestigationEntity[]
): InvestigationEntity[] {
  return entities.map(entity => ({ ...entity, selected: false }));
}

/**
 * Get selected investigation entities
 */
export function getSelectedInvestigationEntities(
  entities: InvestigationEntity[]
): InvestigationEntity[] {
  return entities.filter(entity => entity.selected);
}

/**
 * Filter investigation entities by type
 */
export function filterInvestigationEntitiesByType(
  entities: InvestigationEntity[],
  typeFilter: string
): InvestigationEntity[] {
  if (typeFilter === 'all') {
    return entities;
  }
  return entities.filter(entity => entity.type === typeFilter);
}

/**
 * Get unique entity types from investigation entities
 */
export function getInvestigationEntityTypes(
  entities: InvestigationEntity[]
): string[] {
  const types = new Set<string>();
  for (const entity of entities) {
    if (entity.type) {
      types.add(entity.type);
    }
  }
  return Array.from(types).sort();
}

