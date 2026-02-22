export type {
  FieldDirection,
  FieldLocation,
  ResolutionStrategy,
  FieldMapping,
  ConnectorSchema,
  ParsedBaseFrontmatter,
  ParsedComment,
  ParsedBodySection,
  ParsedBlockId,
  ParsedConnectorDocument,
  ChangeType,
  SemanticChange,
  DiffResult,
  ActionType,
  ApiAction,
  LookupResolver,
  TransformRegistry,
  WritebackResult,
} from './types.js';

export { parseConnectorMarkdown } from './parser.js';
export { diffDocuments } from './diff.js';
export { mapChangesToActions } from './mapper.js';
export type { BlockDiffResult, BlockDiffProvider } from './mapper.js';
export { SchemaRegistry, createDefaultRegistry, getWritableFields, getFieldsByLocation } from './registry.js';
export { WritebackEngine } from './engine.js';
export type { ItemStore, ContentStore, ConflictDetector, ExecutorParams, WritebackExecutor } from './engine.js';

// Schemas
export { LINEAR_ISSUE_SCHEMA } from './schemas/linear-issue.js';
export { LINEAR_DOCUMENT_SCHEMA } from './schemas/linear-document.js';
export { NOTION_PAGE_SCHEMA } from './schemas/notion-page.js';
export { CONFLUENCE_PAGE_SCHEMA } from './schemas/confluence-page.js';
