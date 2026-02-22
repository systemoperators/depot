/**
 * ConnectorSchema registry
 * Configurable registry - products register their own schemas
 */

import type { ConnectorSchema, FieldMapping } from './types.js';
import { LINEAR_ISSUE_SCHEMA } from './schemas/linear-issue.js';
import { LINEAR_DOCUMENT_SCHEMA } from './schemas/linear-document.js';
import { NOTION_PAGE_SCHEMA } from './schemas/notion-page.js';
import { CONFLUENCE_PAGE_SCHEMA } from './schemas/confluence-page.js';

export class SchemaRegistry {
  private schemas = new Map<string, ConnectorSchema>();

  register(schema: ConnectorSchema): void {
    this.schemas.set(schema.entityType, schema);
  }

  getSchema(entityType: string): ConnectorSchema | null {
    return this.schemas.get(entityType) ?? null;
  }

  getRegisteredEntityTypes(): string[] {
    return Array.from(this.schemas.keys());
  }

  supportsWriteback(entityType: string): boolean {
    const schema = this.getSchema(entityType);
    if (!schema) return false;
    return getWritableFields(schema).length > 0;
  }
}

/**
 * Create a registry pre-loaded with all included connector schemas
 */
export function createDefaultRegistry(): SchemaRegistry {
  const registry = new SchemaRegistry();
  registry.register(LINEAR_ISSUE_SCHEMA);
  registry.register(LINEAR_DOCUMENT_SCHEMA);
  registry.register(NOTION_PAGE_SCHEMA);
  registry.register(CONFLUENCE_PAGE_SCHEMA);
  return registry;
}

/**
 * Get only writable fields (readwrite or write direction)
 */
export function getWritableFields(schema: ConnectorSchema): FieldMapping[] {
  return schema.fields.filter(f => f.direction === 'readwrite' || f.direction === 'write');
}

/**
 * Get fields by location
 */
export function getFieldsByLocation(schema: ConnectorSchema, location: FieldMapping['location']): FieldMapping[] {
  return schema.fields.filter(f => f.location === location);
}
