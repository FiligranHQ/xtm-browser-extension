/**
 * Container Message Handlers - Extracted from background/index.ts
 *
 * These handlers process container-related messages for OpenCTI.
 * They are called directly from the main message handler switch statement.
 */

import { OpenCTIClient } from '../../shared/api/opencti-client';
import { refangIndicator } from '../../shared/detection/patterns';
import { errorResponse, type SendResponseFn } from '../../shared/types/common';
import type { CreateContainerPayload } from '../../shared/types/messages';
import type { FailedEntityImport } from '../../shared/types/scan';
import { loggers } from '../../shared/utils/logger';
import type { OCTIContainerType } from '../../shared/types/opencti';

const log = loggers.background;

/**
 * CREATE_CONTAINER handler
 */
export async function handleCreateContainer(
  payload: CreateContainerPayload,
  sendResponse: SendResponseFn,
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

    // Step 0: Create any entities that don't exist yet.
    // Each entry maps 1-to-1 with entitiesToCreate so relationship indices stay stable:
    // a failed creation leaves null in the slot rather than shifting subsequent entries.
    type CreationResult =
      | { status: 'created'; id: string }
      | { status: 'failed'; type: string; value: string; error: string };

    // Pre-create draft workspace so ALL entities, relationships and external references
    // are seeded into the draft context before the container itself is created.
    let draftId: string | undefined;
    if (payload.createAsDraft) {
      const draftWorkspace = await client.createDraftWorkspace(`Draft - ${payload.name}`);
      draftId = draftWorkspace.id;
      log.debug(`Pre-created draft workspace: ${draftId}`);
    }

    const creationResults: CreationResult[] = await Promise.all(
      (payload.entitiesToCreate || []).map(async (e): Promise<CreationResult> => {
        try {
          const cleanValue = refangIndicator(e.value);
          const created = await client.createEntity({ type: e.type, value: cleanValue, name: cleanValue }, draftId);
          log.debug(`Created entity: ${e.type} = ${cleanValue} -> ${created.id}`);
          return { status: 'created', id: created.id };
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Failed to create entity';
          log.warn(`Failed to create entity ${e.type}:${e.value}:`, err);
          return { status: 'failed', type: e.type, value: e.value, error };
        }
      })
    );

    const failedEntities: FailedEntityImport[] = creationResults
      .filter((r) => r.status === 'failed')
      .map(({ type, value, error }) => ({ type, value, error }));

    // Slot-indexed array for relationship resolution: null where creation failed.
    // Prefixed with pre-existing entity ids so UI-side indices remain valid.
    const entitySlots: Array<string | null> = [
      ...(payload.entities || []),
      ...creationResults.map(r => (r.status === 'created' ? r.id : null)),
    ];

    // Flat list of all valid ids for the container objects list.
    const allEntityIds = entitySlots.filter((id): id is string => id !== null);

    // Step 1: Create relationships if provided (before container, so we can include them)
    const createdRelationships: Array<{ id: string; relationship_type: string }> = [];
    if (payload.relationshipsToCreate && payload.relationshipsToCreate.length > 0 && allEntityIds.length > 0) {
      log.info(`Creating ${payload.relationshipsToCreate.length} relationships...`);

      for (const rel of payload.relationshipsToCreate) {
        try {
          // Get entity IDs from slots — null means that entity failed to create
          const fromId = entitySlots[rel.fromEntityIndex];
          const toId = entitySlots[rel.toEntityIndex];

          if (!fromId || !toId) {
            log.warn(`Skipping relationship: entity at index ${!fromId ? rel.fromEntityIndex : rel.toEntityIndex} was not created`);
            continue;
          }

          const relationship = await client.createStixCoreRelationship({
            fromId,
            toId,
            relationship_type: rel.relationship_type,
            description: rel.description,
          }, draftId);

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

    // Step 2: Create external reference
    // For PDF sources: use external_id (the filename) instead of URL
    // For web pages: use URL as before
    let externalReferenceId: string | undefined;
    if (payload.isPdfSource && payload.pdfFileName) {
      // PDF source: create external reference with filename as external_id
      try {
        const extRef = await client.createExternalReference({
          source_name: 'PDF Document',
          description: payload.pageTitle || 'Source PDF document',
          external_id: payload.pdfFileName,
        }, draftId);
        externalReferenceId = extRef.id;
        log.debug(`Created external reference with external_id: ${payload.pdfFileName}`);
      } catch (extRefError) {
        log.warn('Failed to create external reference:', extRefError);
        // Continue without external reference
      }
    } else if (payload.pageUrl) {
      // Web page: create external reference with URL
      try {
        const extRef = await client.createExternalReference({
          source_name: 'Web Article',
          description: payload.pageTitle || 'Source article',
          url: payload.pageUrl,
        }, draftId);
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
      // Draft mode: pass pre-created draftId so createContainer skips internal workspace creation
      createAsDraft: payload.createAsDraft,
      draftId,
      // Update mode: pass original dates to avoid creating duplicates
      // For Reports, use 'published'; for other containers, use 'created'
      published: payload.published,
      created: payload.created,
    });

    // Step 4: Attach external reference to the container
    if (externalReferenceId && container.id) {
      try {
        await client.addExternalReferenceToEntity(container.id, externalReferenceId, draftId);
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
        platformId: platformId,
        _createdRelationships: createdRelationships,
        failedEntities: failedEntities.length > 0 ? failedEntities : undefined,
      }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create container',
    });
  }
}
