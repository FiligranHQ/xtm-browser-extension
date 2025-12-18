/**
 * Container Message Handlers - Extracted from background/index.ts
 * 
 * These handlers process container-related messages for OpenCTI.
 * They are called directly from the main message handler switch statement.
 */

import { OpenCTIClient } from '../../shared/api/opencti-client';
import { refangIndicator } from '../../shared/detection/patterns';
import { errorResponse } from '../../shared/utils/messaging';
import { loggers } from '../../shared/utils/logger';
import type { OCTIContainerType } from '../../shared/types';

const log = loggers.background;

type SendResponse = (response: unknown) => void;

/**
 * CREATE_CONTAINER handler payload
 */
export interface CreateContainerPayload {
  type: string;
  name: string;
  description?: string;
  content?: string;
  labels?: string[];
  markings?: string[];
  entities?: string[];
  entitiesToCreate?: Array<{ type: string; value: string }>;
  platformId?: string;
  pdfAttachment?: { data: string; filename: string } | null;
  pageUrl?: string;
  pageTitle?: string;
  // Type-specific fields
  report_types?: string[];
  context?: string;
  severity?: string;
  priority?: string;
  response_types?: string[];
  createdBy?: string;
  // Draft mode
  createAsDraft?: boolean;
  // Relationships to create (from AI resolution or manual)
  relationshipsToCreate?: Array<{
    fromEntityIndex: number;
    toEntityIndex: number;
    relationship_type: string;
    description?: string;
  }>;
  // Update mode: pass existing container ID and dates to avoid duplicates
  updateContainerId?: string;
  published?: string;
  created?: string;
}

/**
 * CREATE_CONTAINER handler
 */
export async function handleCreateContainer(
  payload: CreateContainerPayload,
  sendResponse: SendResponse,
  openCTIClients: Map<string, OpenCTIClient>
): Promise<void> {
  if (openCTIClients.size === 0) {
    sendResponse(errorResponse('Not configured'));
    return;
  }
  
  try {
    // Use specified platform or first available
    const platformId = payload.platformId || openCTIClients.keys().next().value as string | undefined;
    
    if (!platformId) {
      sendResponse(errorResponse('No platform available'));
      return;
    }
    
    const client = openCTIClients.get(platformId);
    
    if (!client) {
      sendResponse(errorResponse('Platform not found'));
      return;
    }
    
    // Step 0: Create any entities that don't exist yet
    const allEntityIds: string[] = [...(payload.entities || [])];
    
    if (payload.entitiesToCreate && payload.entitiesToCreate.length > 0) {
      log.info(`Creating ${payload.entitiesToCreate.length} new entities for container...`);
      
      for (const entityToCreate of payload.entitiesToCreate) {
        try {
          // Refang the value before creating (OpenCTI stores clean values)
          const cleanValue = refangIndicator(entityToCreate.value);
          // Use createEntity instead of createObservable to handle both
          // STIX Domain Objects (SDOs) like Vulnerability, Malware, Threat-Actor
          // and STIX Cyber Observables (SCOs) like IP, Domain, Hash
          const created = await client.createEntity({
            type: entityToCreate.type,
            value: cleanValue,
            name: cleanValue, // For SDOs that use name instead of value
          });
          
          if (created?.id) {
            allEntityIds.push(created.id);
            log.debug(`Created entity: ${entityToCreate.type} = ${cleanValue} -> ${created.id}`);
          }
        } catch (entityError) {
          log.warn(`Failed to create entity ${entityToCreate.type}:${entityToCreate.value}:`, entityError);
          // Continue with other entities
        }
      }
      
      log.info(`Created entities. Total entity IDs for container: ${allEntityIds.length}`);
    }
    
    // Step 1: Create relationships if provided (before container, so we can include them)
    const createdRelationships: Array<{ id: string; relationship_type: string }> = [];
    if (payload.relationshipsToCreate && payload.relationshipsToCreate.length > 0 && allEntityIds.length > 0) {
      log.info(`Creating ${payload.relationshipsToCreate.length} relationships...`);
      
      for (const rel of payload.relationshipsToCreate) {
        try {
          // Get entity IDs from indices
          const fromId = allEntityIds[rel.fromEntityIndex];
          const toId = allEntityIds[rel.toEntityIndex];
          
          if (!fromId || !toId) {
            log.warn(`Invalid relationship indices: from=${rel.fromEntityIndex}, to=${rel.toEntityIndex}, available=${allEntityIds.length}`);
            continue;
          }
          
          const relationship = await client.createStixCoreRelationship({
            fromId,
            toId,
            relationship_type: rel.relationship_type,
            description: rel.description,
          });
          
          if (relationship?.id) {
            createdRelationships.push({
              id: relationship.id,
              relationship_type: rel.relationship_type,
            });
            log.debug(`Created relationship: ${fromId} --[${rel.relationship_type}]--> ${toId}`);
          }
        } catch (relError) {
          log.warn(`Failed to create relationship: ${rel.relationship_type}`, relError);
          // Continue with other relationships
        }
      }
      
      log.info(`Created ${createdRelationships.length} of ${payload.relationshipsToCreate.length} relationships`);
    }
    
    // Step 2: Create external reference if page URL is provided
    let externalReferenceId: string | undefined;
    if (payload.pageUrl) {
      try {
        const extRef = await client.createExternalReference({
          source_name: 'Web Article',
          description: payload.pageTitle || 'Source article',
          url: payload.pageUrl,
        });
        externalReferenceId = extRef.id;
        log.debug(`Created external reference: ${externalReferenceId}`);
      } catch (extRefError) {
        log.warn('Failed to create external reference:', extRefError);
        // Continue without external reference
      }
    }
    
    // Step 3: Create the container with ALL IDs (entities + relationships)
    const allObjectIds = [
      ...allEntityIds,
      ...createdRelationships.map(r => r.id),
    ];
    
    log.info(`${payload.updateContainerId ? 'Updating' : 'Creating'} container with ${allEntityIds.length} entities and ${createdRelationships.length} relationships`);
    
    const container = await client.createContainer({
      type: payload.type as OCTIContainerType,
      name: payload.name,
      description: payload.description,
      content: payload.content,
      objects: allObjectIds,
      objectLabel: payload.labels || [],
      objectMarking: payload.markings || [],
      // Type-specific fields
      report_types: payload.report_types,
      context: payload.context,
      severity: payload.severity,
      priority: payload.priority,
      response_types: payload.response_types,
      createdBy: payload.createdBy,
      // Draft mode
      createAsDraft: payload.createAsDraft,
      // Update mode: pass original dates to avoid creating duplicates
      // For Reports, use 'published'; for other containers, use 'created'
      published: payload.published,
      created: payload.created,
    });
    
    // Step 4: Attach external reference to the container
    if (externalReferenceId && container.id) {
      try {
        await client.addExternalReferenceToEntity(container.id, externalReferenceId);
        log.debug('Attached external reference to container');
      } catch (attachError) {
        log.warn('Failed to attach external reference to container:', attachError);
        // Continue - container was created successfully
      }
    }
    
    // Step 5: Upload PDF attachment if provided
    if (payload.pdfAttachment && container.id) {
      try {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(payload.pdfAttachment.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        await client.uploadFileToEntity(container.id, {
          name: payload.pdfAttachment.filename,
          data: bytes.buffer,
          mimeType: 'application/pdf',
        });
        log.debug(`PDF attached to container: ${payload.pdfAttachment.filename}`);
      } catch (pdfError) {
        log.error('Failed to attach PDF to container:', pdfError);
        // Don't fail the whole operation, container was created successfully
      }
    }
    
    sendResponse({ 
      success: true, 
      data: { 
        ...container, 
        _platformId: platformId,
        _createdRelationships: createdRelationships,
      } 
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create container',
    });
  }
}
