/**
 * Semantic differ for writeback
 * Compares base and edited ParsedConnectorDocuments to produce field-level changes
 * Only diffs fields declared readwrite/write in the schema
 */

import type {
  ConnectorSchema,
  ParsedConnectorDocument,
  SemanticChange,
  DiffResult,
  FieldMapping,
} from './types.js';
import { getWritableFields } from './registry.js';

/**
 * Diff two parsed connector documents using schema to determine which fields to compare
 */
export function diffDocuments(
  base: ParsedConnectorDocument,
  current: ParsedConnectorDocument,
  schema: ConnectorSchema,
): DiffResult {
  const frontmatterChanges: SemanticChange[] = [];
  const bodyChanges: SemanticChange[] = [];
  const commentChanges: SemanticChange[] = [];

  const writableFields = getWritableFields(schema);

  for (const field of writableFields) {
    switch (field.location) {
      case 'frontmatter':
        diffFrontmatterField(base, current, field, schema, frontmatterChanges);
        break;
      case 'body_title':
        diffTitle(base, current, field, bodyChanges);
        break;
      case 'body_section':
        diffSection(base, current, field, bodyChanges);
        break;
      case 'block_content':
        diffBlockContent(base, current, field, bodyChanges);
        break;
    }
  }

  diffComments(base, current, commentChanges);
  diffTags(base, current, schema, frontmatterChanges);

  const changes = [...frontmatterChanges, ...bodyChanges, ...commentChanges];

  return {
    hasChanges: changes.length > 0,
    changes,
    frontmatterChanges,
    bodyChanges,
    commentChanges,
  };
}

function diffFrontmatterField(
  base: ParsedConnectorDocument,
  current: ParsedConnectorDocument,
  field: FieldMapping,
  schema: ConnectorSchema,
  changes: SemanticChange[],
): void {
  if (field.markdownField === 'tags') return;

  const oldValue = base.connectorMeta[field.markdownField];
  const newValue = current.connectorMeta[field.markdownField];

  if (normalizeValue(oldValue) !== normalizeValue(newValue)) {
    changes.push({
      type: 'field_changed',
      field: `${schema.frontmatterNamespace}.${field.markdownField}`,
      oldValue,
      newValue,
    });
  }
}

function diffTitle(
  base: ParsedConnectorDocument,
  current: ParsedConnectorDocument,
  _field: FieldMapping,
  changes: SemanticChange[],
): void {
  const oldTitle = base.title.trim();
  const newTitle = current.title.trim();

  if (oldTitle !== newTitle) {
    changes.push({
      type: 'title_changed',
      field: 'title',
      oldValue: oldTitle,
      newValue: newTitle,
    });
  }
}

function diffSection(
  base: ParsedConnectorDocument,
  current: ParsedConnectorDocument,
  field: FieldMapping,
  changes: SemanticChange[],
): void {
  const sectionName = field.markdownField === 'description' ? 'description' : field.markdownField;

  const oldContent = normalizeWhitespace(base[sectionName as keyof ParsedConnectorDocument] as string | null);
  const newContent = normalizeWhitespace(current[sectionName as keyof ParsedConnectorDocument] as string | null);

  if (oldContent !== newContent) {
    changes.push({
      type: 'description_changed',
      field: sectionName,
      oldValue: base[sectionName as keyof ParsedConnectorDocument],
      newValue: current[sectionName as keyof ParsedConnectorDocument],
    });
  }
}

function diffBlockContent(
  base: ParsedConnectorDocument,
  current: ParsedConnectorDocument,
  _field: FieldMapping,
  changes: SemanticChange[],
): void {
  const oldContent = normalizeWhitespace(base.bodyContent);
  const newContent = normalizeWhitespace(current.bodyContent);

  if (oldContent !== newContent) {
    changes.push({
      type: 'description_changed',
      field: 'body',
      oldValue: base.bodyContent,
      newValue: current.bodyContent,
    });
  }
}

function diffComments(
  base: ParsedConnectorDocument,
  current: ParsedConnectorDocument,
  changes: SemanticChange[],
): void {
  const baseCommentMap = new Map(
    base.comments.filter(c => c.id).map(c => [c.id!, c])
  );

  for (const comment of current.comments) {
    if (comment.isNew || !comment.id) {
      changes.push({
        type: 'comment_added',
        field: 'comments',
        oldValue: null,
        newValue: comment.body,
        commentBody: comment.body,
      });
    } else {
      const baseComment = baseCommentMap.get(comment.id);
      if (baseComment && normalizeWhitespace(baseComment.body) !== normalizeWhitespace(comment.body)) {
        changes.push({
          type: 'comment_edited',
          field: 'comments',
          oldValue: baseComment.body,
          newValue: comment.body,
          commentId: comment.id,
          commentBody: comment.body,
        });
      }
    }
  }
}

function diffTags(
  base: ParsedConnectorDocument,
  current: ParsedConnectorDocument,
  schema: ConnectorSchema,
  changes: SemanticChange[],
): void {
  const tagsField = schema.fields.find(f => f.markdownField === 'tags' && (f.direction === 'readwrite' || f.direction === 'write'));
  if (!tagsField) return;

  const oldTags = new Set(base.base.tags);
  const newTags = new Set(current.base.tags);

  for (const tag of newTags) {
    if (!oldTags.has(tag)) {
      changes.push({
        type: 'tag_added',
        field: 'tags',
        oldValue: null,
        newValue: tag,
      });
    }
  }

  for (const tag of oldTags) {
    if (!newTags.has(tag)) {
      changes.push({
        type: 'tag_removed',
        field: 'tags',
        oldValue: tag,
        newValue: null,
      });
    }
  }
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return JSON.stringify(value);
}

function normalizeWhitespace(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
