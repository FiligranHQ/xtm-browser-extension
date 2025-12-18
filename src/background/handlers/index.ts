/**
 * Background Message Handlers
 * 
 * Contains the createHandlerRegistry function for combining all handler modules.
 */

import { openctiHandlers } from './opencti-handlers';
import { openaevHandlers } from './openaev-handlers';
import { aiHandlers } from './ai-handlers';
import { cacheHandlers } from './cache-handlers';
import { miscHandlers } from './misc-handlers';
import type { MessageHandler } from './types';

/**
 * Create a combined handler registry from all handler modules
 */
export function createHandlerRegistry(): Map<string, MessageHandler> {
  const registry = new Map<string, MessageHandler>();
  
  // Add all handlers to registry
  const allHandlers = [
    openctiHandlers,
    openaevHandlers,
    aiHandlers,
    cacheHandlers,
    miscHandlers,
  ];
  
  for (const handlers of allHandlers) {
    for (const [type, handler] of Object.entries(handlers)) {
      registry.set(type, handler as MessageHandler);
    }
  }
  
  return registry;
}
