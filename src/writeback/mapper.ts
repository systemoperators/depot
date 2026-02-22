/**
 * Action mapper for writeback
 * Converts semantic changes into API actions (update_entity, create_comment, update_blocks)
 * Applies resolution strategies: direct, lookup, transform, block_diff, adf_convert
 */

import type {
  ConnectorSchema,
  DiffResult,
  SemanticChange,
  ApiAction,
  LookupResolver,
  TransformRegistry,
  FieldMapping,
  ParsedConnectorDocument,
} from './types.js';
import { getWritableFields } from './registry.js';

/**
 * Block diff result from product-specific block converter
 * Products inject their own implementation (e.g. notion-blocks-from-markdown)
 */
export interface BlockDiffResult {
  updates: Array<{ blockId: string; blockData: Record<string, unknown> }>;
  appends: Array<{ afterBlockId: string | null; blocks: unknown[] }>;
  deletes: Array<{ blockId: string }>;
}

/**
 * Interface for block diff providers
 * Products implement this to decouple from specific block converters
 */
export interface BlockDiffProvider {
  diffBlocksVsMarkdown(originalBlockIds: string[], editedMarkdown: string): BlockDiffResult;
}

/**
 * Map semantic changes to API actions
 * - Batches all field updates into one update_entity action
 * - Creates separate create_comment actions per new comment
 * - Creates update_blocks actions for block_diff resolution
 * - Passes adf_convert body changes through as update_entity with raw markdown
 * - Order: entity update first, then block updates, then comments
 */
export async function mapChangesToActions(
  diff: DiffResult,
  schema: ConnectorSchema,
  resolver: LookupResolver,
  transforms: TransformRegistry,
  baseDoc?: ParsedConnectorDocument,
  blockDiffProvider?: BlockDiffProvider,
): Promise<ApiAction[]> {
  if (!diff.hasChanges) return [];

  const actions: ApiAction[] = [];
  const updateFields: Record<string, unknown> = {};
  const updateSourceChanges: SemanticChange[] = [];

  const writableFields = getWritableFields(schema);
  const fieldMap = new Map(writableFields.map(f => [f.markdownField, f]));

  const entityChanges = [...diff.frontmatterChanges, ...diff.bodyChanges];

  for (const change of entityChanges) {
    const fieldDef = resolveFieldDef(change, fieldMap, schema);
    if (!fieldDef) continue;

    if (fieldDef.resolution === 'block_diff' || fieldDef.resolution === 'adf_convert') {
      continue;
    }

    const resolvedValue = await resolveValue(change.newValue, fieldDef, resolver, transforms);
    if (resolvedValue !== undefined) {
      updateFields[fieldDef.apiField] = resolvedValue;
      updateSourceChanges.push(change);
    }
  }

  // Handle tag changes -> labelIds
  const tagChanges = diff.frontmatterChanges.filter(c => c.type === 'tag_added' || c.type === 'tag_removed');
  if (tagChanges.length > 0) {
    const tagsField = fieldMap.get('tags');
    if (tagsField) {
      const addedTags = tagChanges.filter(c => c.type === 'tag_added').map(c => c.newValue as string);

      if (addedTags.length > 0 && tagsField.resolution === 'lookup' && tagsField.lookupEntity && tagsField.lookupMatchField) {
        const resolvedIds = await resolver.resolve(tagsField.lookupEntity, tagsField.lookupMatchField, addedTags);
        if (resolvedIds) {
          const existing = updateFields[tagsField.apiField] as string[] | undefined;
          const merged = [...(existing || []), ...(Array.isArray(resolvedIds) ? resolvedIds : [resolvedIds])];
          updateFields[tagsField.apiField] = merged;
          updateSourceChanges.push(...tagChanges);
        }
      }
    }
  }

  if (Object.keys(updateFields).length > 0) {
    actions.push({
      type: 'update_entity',
      updateFields,
      sourceChanges: updateSourceChanges,
    });
  }

  // Handle block_diff resolution - produces update_blocks action
  const blockDiffChanges = entityChanges.filter(change => {
    const fieldDef = resolveFieldDef(change, fieldMap, schema);
    return fieldDef?.resolution === 'block_diff';
  });

  if (blockDiffChanges.length > 0 && baseDoc && blockDiffProvider) {
    const bodyChange = blockDiffChanges[0];
    const editedMarkdown = bodyChange.newValue as string;
    const originalBlockIds = baseDoc.blockIds.map(b => b.id);

    const blockDiff = blockDiffProvider.diffBlocksVsMarkdown(originalBlockIds, editedMarkdown);

    if (blockDiff.updates.length > 0 || blockDiff.appends.length > 0 || blockDiff.deletes.length > 0) {
      actions.push({
        type: 'update_blocks',
        sourceChanges: blockDiffChanges,
        blockUpdates: blockDiff.updates,
        blockAppends: blockDiff.appends.map(a => ({
          afterBlockId: a.afterBlockId,
          blocks: a.blocks as Record<string, unknown>[],
        })),
        blockDeletes: blockDiff.deletes,
      });
    }
  }

  // Handle adf_convert resolution (Confluence)
  const adfConvertChanges = entityChanges.filter(change => {
    const fieldDef = resolveFieldDef(change, fieldMap, schema);
    return fieldDef?.resolution === 'adf_convert';
  });

  if (adfConvertChanges.length > 0) {
    const bodyChange = adfConvertChanges[0];
    const fieldDef = resolveFieldDef(bodyChange, fieldMap, schema)!;
    actions.push({
      type: 'update_entity',
      updateFields: { [fieldDef.apiField]: bodyChange.newValue },
      sourceChanges: adfConvertChanges,
    });
  }

  // Process comment changes
  for (const change of diff.commentChanges) {
    if (change.type === 'comment_added' && change.commentBody) {
      actions.push({
        type: 'create_comment',
        commentBody: change.commentBody,
        sourceChanges: [change],
      });
    }
  }

  return actions;
}

function resolveFieldDef(
  change: SemanticChange,
  fieldMap: Map<string, FieldMapping>,
  schema: ConnectorSchema,
): FieldMapping | null {
  if (change.type === 'title_changed') {
    return fieldMap.get('title') ?? null;
  }

  if (change.type === 'description_changed') {
    return fieldMap.get('description') ?? fieldMap.get('body') ?? fieldMap.get('content') ?? null;
  }

  if (change.type === 'field_changed') {
    const prefix = `${schema.frontmatterNamespace}.`;
    const fieldName = change.field.startsWith(prefix)
      ? change.field.slice(prefix.length)
      : change.field;
    return fieldMap.get(fieldName) ?? null;
  }

  return null;
}

async function resolveValue(
  value: unknown,
  field: FieldMapping,
  resolver: LookupResolver,
  transforms: TransformRegistry,
): Promise<unknown> {
  if (value === null || value === undefined) return value;

  switch (field.resolution) {
    case 'direct':
      return coerceType(value, field.valueType);

    case 'lookup':
      if (!field.lookupEntity || !field.lookupMatchField) {
        throw new Error(`Lookup field ${field.markdownField} missing lookupEntity or lookupMatchField`);
      }
      if (Array.isArray(value)) {
        return resolver.resolve(field.lookupEntity, field.lookupMatchField, value as string[]);
      }
      return resolver.resolve(field.lookupEntity, field.lookupMatchField, String(value));

    case 'transform':
      if (!field.transformFn) {
        throw new Error(`Transform field ${field.markdownField} missing transformFn`);
      }
      return transforms.transform(field.transformFn, value);

    case 'block_diff':
    case 'adf_convert':
      return value;

    default:
      return value;
  }
}

function coerceType(value: unknown, valueType: FieldMapping['valueType']): unknown {
  if (value === null || value === undefined) return value;

  switch (valueType) {
    case 'string':
      return String(value);
    case 'number':
      return typeof value === 'number' ? value : Number(value);
    case 'boolean':
      return typeof value === 'boolean' ? value : value === 'true';
    case 'date':
      return String(value);
    case 'string[]':
      if (Array.isArray(value)) return value.map(String);
      return [String(value)];
    default:
      return value;
  }
}
