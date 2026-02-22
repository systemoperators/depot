/**
 * Writeback system types
 * Bidirectional sync: parse edited markdown, diff against base, map to API actions
 */

// Field mapping types
export type FieldDirection = 'read' | 'write' | 'readwrite';
export type FieldLocation = 'frontmatter' | 'body_title' | 'body_section' | 'block_content' | 'comment';
export type ResolutionStrategy = 'direct' | 'lookup' | 'transform' | 'block_diff' | 'adf_convert';

export interface FieldMapping {
  markdownField: string;
  location: FieldLocation;
  apiField: string;
  direction: FieldDirection;
  resolution: ResolutionStrategy;
  lookupEntity?: string;
  lookupMatchField?: string;
  transformFn?: string;
  required?: boolean;
  valueType: 'string' | 'number' | 'boolean' | 'string[]' | 'date';
}

export interface ConnectorSchema {
  connector: string;
  entityType: string;
  frontmatterNamespace: string;
  updateMethod: string;
  entityIdField: string;
  connectionIdSource: 'item_connectionId';
  fields: FieldMapping[];
}

// Parsed document types
export interface ParsedBaseFrontmatter {
  title: string;
  source: string;
  sourceRef: string;
  sourceUrl: string;
  created: string;
  updated: string;
  author?: string;
  tags: string[];
}

export interface ParsedComment {
  id: string | null;
  author: string;
  date: string;
  body: string;
  isNew: boolean;
}

export interface ParsedBodySection {
  heading: string;
  content: string;
  blockId?: string;
}

export interface ParsedBlockId {
  type: string;
  id: string;
  metadata: Record<string, string>;
}

export interface ParsedConnectorDocument {
  base: ParsedBaseFrontmatter;
  connectorMeta: Record<string, unknown>;
  title: string;
  description: string | null;
  bodyContent: string | null;
  comments: ParsedComment[];
  sections: ParsedBodySection[];
  blockIds: ParsedBlockId[];
}

// Diff and action types
export type ChangeType =
  | 'field_changed' | 'title_changed' | 'description_changed'
  | 'comment_added' | 'comment_edited'
  | 'tag_added' | 'tag_removed';

export interface SemanticChange {
  type: ChangeType;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  commentId?: string;
  commentBody?: string;
}

export interface DiffResult {
  hasChanges: boolean;
  changes: SemanticChange[];
  frontmatterChanges: SemanticChange[];
  bodyChanges: SemanticChange[];
  commentChanges: SemanticChange[];
}

export type ActionType = 'update_entity' | 'create_comment' | 'update_blocks';

export interface ApiAction {
  type: ActionType;
  updateFields?: Record<string, unknown>;
  commentBody?: string;
  sourceChanges: SemanticChange[];
  blockUpdates?: Array<{ blockId: string; blockData: Record<string, unknown> }>;
  blockAppends?: Array<{ afterBlockId: string | null; blocks: Record<string, unknown>[] }>;
  blockDeletes?: Array<{ blockId: string }>;
}

export interface LookupResolver {
  resolve(entity: string, matchField: string, value: string | string[]): Promise<string | string[] | null>;
}

export interface TransformRegistry {
  transform(fnName: string, value: unknown): unknown;
}

export interface WritebackResult {
  status: 'success' | 'no_changes' | 'conflict' | 'error';
  actions?: ApiAction[];
  error?: string;
  conflictDetails?: {
    localUpdatedAt: string;
    remoteUpdatedAt: string;
  };
}
