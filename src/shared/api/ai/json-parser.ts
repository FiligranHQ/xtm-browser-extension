/**
 * AI JSON Response Parser
 * Utilities for parsing JSON from AI responses with various fallback strategies
 */

import { loggers } from '../../utils/logger';

const log = loggers.ai;

/**
 * Parse JSON from AI response (handles markdown code blocks and various edge cases)
 */
export function parseAIJsonResponse<T>(content: string): T | null {
  if (!content || typeof content !== 'string') {
    log.error('[parseAIJsonResponse] Invalid content: null or not a string');
    return null;
  }
  
  // Trim whitespace
  let trimmed = content.trim();
  
  if (!trimmed) {
    log.error('[parseAIJsonResponse] Empty content after trimming');
    return null;
  }
  
  // Remove markdown code block markers if present
  if (trimmed.startsWith('```json')) {
    trimmed = trimmed.slice(7);
  } else if (trimmed.startsWith('```')) {
    trimmed = trimmed.slice(3);
  }
  
  // Remove closing ``` if present
  trimmed = trimmed.replace(/```\s*$/, '');
  trimmed = trimmed.trim();
  
  // Attempt multiple parsing strategies
  const strategies = [
    // Strategy 1: Direct parse of trimmed content
    () => JSON.parse(trimmed),
    
    // Strategy 2: Extract from markdown code block (greedy)
    () => {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*)```/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1].trim());
      }
      throw new Error('No markdown code block found');
    },
    
    // Strategy 3: Extract from markdown code block WITHOUT closing (truncated)
    () => {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*)/);
      if (jsonMatch && jsonMatch[1]) {
        const jsonContent = jsonMatch[1].trim().replace(/```\s*$/, '').trim();
        return JSON.parse(jsonContent);
      }
      throw new Error('No markdown code block found');
    },
    
    // Strategy 4: Find balanced JSON object from trimmed
    () => {
      const jsonStr = extractBalancedJson(trimmed);
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
      throw new Error('No balanced JSON found');
    },
    
    // Strategy 5: Find balanced JSON object from original content
    () => {
      const jsonStr = extractBalancedJson(content);
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
      throw new Error('No balanced JSON found in original');
    },
    
    // Strategy 6: Greedy match for JSON object
    () => {
      const jsonObjectMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        return JSON.parse(jsonObjectMatch[0]);
      }
      throw new Error('No JSON object found');
    },
    
    // Strategy 7: Find JSON array
    () => {
      const jsonArrayMatch = trimmed.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch) {
        return JSON.parse(jsonArrayMatch[0]);
      }
      throw new Error('No JSON array found');
    },
    
    // Strategy 8: Try to fix common JSON issues (trailing commas, etc.)
    () => {
      let fixed = trimmed;
      // Remove trailing commas before } or ]
      fixed = fixed.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(fixed);
    },
    
    // Strategy 9: Try to find balanced JSON after fixing
    () => {
      let fixed = trimmed;
      fixed = fixed.replace(/,\s*([\]}])/g, '$1');
      const jsonStr = extractBalancedJson(fixed);
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
      throw new Error('No balanced JSON found after fixing');
    },
    
    // Strategy 10: Try to complete truncated JSON
    () => {
      const completed = tryCompleteJson(trimmed);
      if (completed) {
        return JSON.parse(completed);
      }
      throw new Error('Could not complete truncated JSON');
    },
    
    // Strategy 11: Extract only complete items from truncated arrays (for relationships, etc.)
    () => {
      const extracted = tryExtractCompleteItems(trimmed);
      if (extracted) {
        return JSON.parse(extracted);
      }
      throw new Error('Could not extract complete items');
    },
    
    // Strategy 12: Try to complete truncated JSON from original content
    () => {
      const completed = tryCompleteJson(content);
      if (completed) {
        return JSON.parse(completed);
      }
      throw new Error('Could not complete truncated JSON from original');
    },
    
    // Strategy 13: Extract complete items from original content
    () => {
      const extracted = tryExtractCompleteItems(content);
      if (extracted) {
        return JSON.parse(extracted);
      }
      throw new Error('Could not extract complete items from original');
    },
  ];
  
  const errors: string[] = [];
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (result !== null && result !== undefined) {
        return result as T;
      }
    } catch (e) {
      errors.push(`Strategy ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  log.error('[parseAIJsonResponse] All parsing strategies failed.');
  log.error('[parseAIJsonResponse] Strategy errors:', errors.join(' | '));
  log.error('[parseAIJsonResponse] Content length:', trimmed.length);
  log.error('[parseAIJsonResponse] FULL CONTENT START >>>');
  log.error(trimmed);
  log.error('[parseAIJsonResponse] <<< FULL CONTENT END');
  
  return null;
}

/**
 * Try to complete truncated JSON by adding missing closing brackets
 */
function tryCompleteJson(content: string): string | null {
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
    }
  }
  
  // If we have unclosed structures, try to close them
  if (braceCount > 0 || bracketCount > 0 || inString) {
    let completed = content;
    
    // If we're in a string, close it first
    if (inString) {
      completed += '"';
    }
    
    // Remove various incomplete trailing patterns
    // Handle truncated values like "key": ... or "key": "incomplete
    completed = completed.replace(/,\s*$/, '');
    completed = completed.replace(/,\s*"[^"]*$/, '');
    completed = completed.replace(/:\s*\.{2,}\s*$/, ': ""');  // Handle : ...
    completed = completed.replace(/:\s*[^"[{}\]\s,][^,\]}]*$/, ': ""');  // Handle : incomplete_value
    completed = completed.replace(/:\s*$/, ': null');
    completed = completed.replace(/:\s*"[^"]*$/, ': ""');
    completed = completed.replace(/"[^"]*$/, '""');  // Handle incomplete string at end
    
    // Remove incomplete object/array items at the end
    completed = completed.replace(/,\s*\{[^}]*$/, '');  // Remove incomplete object in array
    completed = completed.replace(/,\s*$/, '');  // Clean up trailing comma
    
    // Close brackets and braces
    for (let i = 0; i < bracketCount; i++) {
      completed += ']';
    }
    for (let i = 0; i < braceCount; i++) {
      completed += '}';
    }
    
    return completed;
  }
  
  return null;
}

/**
 * Extract complete objects from an array in truncated JSON
 */
function extractCompleteObjectsFromArray(content: string, arrayStart: number): string[] {
  const completeObjects: string[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;
  
  for (let i = arrayStart; i < content.length; i++) {
    const char = content[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        if (depth === 0) objectStart = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && objectStart !== -1) {
          completeObjects.push(content.substring(objectStart, i + 1));
          objectStart = -1;
        }
      } else if (char === ']' && depth === 0) {
        // End of array
        break;
      }
    }
  }
  
  return completeObjects;
}

/**
 * Try to extract complete array items from truncated JSON
 * This handles cases where the array is truncated mid-item
 * Works for both entities and relationships arrays
 */
function tryExtractCompleteItems(content: string): string | null {
  const result: Record<string, unknown[]> = {};
  
  // Try to extract entities array
  const entitiesMatch = content.match(/"entities"\s*:\s*\[/);
  if (entitiesMatch) {
    const arrayStart = content.indexOf(entitiesMatch[0]) + entitiesMatch[0].length;
    const entities = extractCompleteObjectsFromArray(content, arrayStart);
    if (entities.length > 0) {
      result.entities = entities.map(e => {
        try { return JSON.parse(e); } catch { return null; }
      }).filter(e => e !== null);
    }
  }
  
  // Try to extract relationships array
  const relationshipsMatch = content.match(/"relationships"\s*:\s*\[/);
  if (relationshipsMatch) {
    const arrayStart = content.indexOf(relationshipsMatch[0]) + relationshipsMatch[0].length;
    const relationships = extractCompleteObjectsFromArray(content, arrayStart);
    if (relationships.length > 0) {
      result.relationships = relationships.map(r => {
        try { return JSON.parse(r); } catch { return null; }
      }).filter(r => r !== null);
    }
  }
  
  // If we found at least one array with items, return the result
  if (Object.keys(result).length > 0 && 
      ((result.entities && (result.entities as unknown[]).length > 0) || 
       (result.relationships && (result.relationships as unknown[]).length > 0))) {
    // Ensure both arrays exist (even if empty)
    if (!result.entities) result.entities = [];
    if (!result.relationships) result.relationships = [];
    return JSON.stringify(result);
  }
  
  return null;
}

/**
 * Extract balanced JSON from a string by counting braces
 */
function extractBalancedJson(content: string): string | null {
  const startIndex = content.indexOf('{');
  if (startIndex === -1) return null;
  
  let depth = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return content.substring(startIndex, i + 1);
        }
      }
    }
  }
  
  return null;
}

