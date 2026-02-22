/**
 * WritebackEngine - orchestrates the writeback pipeline
 * Parse edited content, diff against base, resolve fields, execute API actions
 *
 * Products inject their own store implementations and executors.
 * Run tracking intentionally omitted - products wrap with @systemoperator/runs.
 */

import type {
  ApiAction,
  ConnectorSchema,
  LookupResolver,
  TransformRegistry,
  WritebackResult,
} from './types.js';
import type { Item, WritebackStatus } from '../types.js';
import { parseConnectorMarkdown } from './parser.js';
import { diffDocuments } from './diff.js';
import { mapChangesToActions, type BlockDiffProvider } from './mapper.js';

/**
 * Store interface for reading items
 */
export interface ItemStore {
  getItem(itemId: string): Promise<Item | null>;
  updateWritebackStatus(itemId: string, status: WritebackStatus): Promise<void>;
}

/**
 * Store interface for reading content from CAS
 */
export interface ContentStore {
  getContent(hash: string): Promise<string | null>;
}

/**
 * Conflict detection interface
 * Products implement with their own logic (e.g. check remote updatedAt vs local)
 */
export interface ConflictDetector {
  checkConflict(entityType: string, sourceRef: string, connectionId: string): Promise<{
    hasConflict: boolean;
    localUpdatedAt?: string;
    remoteUpdatedAt?: string;
  } | null>;
}

/**
 * Executor params passed to WritebackExecutor.execute
 */
export interface ExecutorParams {
  item: Item;
  schema: ConnectorSchema;
  connectionId: string;
  entityId: string;
}

/**
 * Interface for executing API actions against external services
 * Products implement per-connector (Linear, Notion, Confluence, etc.)
 */
export interface WritebackExecutor {
  execute(action: ApiAction, params: ExecutorParams): Promise<void>;
}

export class WritebackEngine {
  constructor(
    private itemStore: ItemStore,
    private contentStore: ContentStore,
    private conflictDetector: ConflictDetector | null,
    private executor: WritebackExecutor,
    private resolver: LookupResolver,
    private transforms: TransformRegistry,
    private blockDiffProvider?: BlockDiffProvider,
  ) {}

  /**
   * Run writeback for a single item
   * Returns result with status and any actions taken
   */
  async writeback(itemId: string, schema: ConnectorSchema): Promise<WritebackResult> {
    const item = await this.itemStore.getItem(itemId);
    if (!item) {
      return { status: 'error', error: 'Item not found' };
    }

    if (!item.entityType || !item.sourceRef || !item.connectionId) {
      return { status: 'error', error: 'Item missing entityType, sourceRef, or connectionId' };
    }

    // Check for conflicts
    if (this.conflictDetector) {
      const conflict = await this.conflictDetector.checkConflict(
        item.entityType, item.sourceRef, item.connectionId
      );
      if (conflict?.hasConflict) {
        await this.itemStore.updateWritebackStatus(itemId, 'conflict');
        return {
          status: 'conflict',
          conflictDetails: {
            localUpdatedAt: conflict.localUpdatedAt ?? '',
            remoteUpdatedAt: conflict.remoteUpdatedAt ?? '',
          },
        };
      }
    }

    // Get base and current content
    if (!item.contentHash || !item.materializedHash) {
      return { status: 'error', error: 'Item missing contentHash or materializedHash' };
    }

    const baseContent = await this.contentStore.getContent(item.contentHash);
    const currentContent = await this.contentStore.getContent(item.materializedHash);

    if (!baseContent || !currentContent) {
      return { status: 'error', error: 'Could not retrieve content from store' };
    }

    // Parse both versions
    const baseDoc = parseConnectorMarkdown(baseContent, schema);
    const currentDoc = parseConnectorMarkdown(currentContent, schema);

    // Diff
    const diff = diffDocuments(baseDoc, currentDoc, schema);
    if (!diff.hasChanges) {
      return { status: 'no_changes' };
    }

    // Map to actions
    const actions = await mapChangesToActions(
      diff, schema, this.resolver, this.transforms, baseDoc, this.blockDiffProvider
    );

    if (actions.length === 0) {
      return { status: 'no_changes' };
    }

    // Execute
    await this.itemStore.updateWritebackStatus(itemId, 'writing');

    try {
      const params: ExecutorParams = {
        item,
        schema,
        connectionId: item.connectionId,
        entityId: item.sourceRef,
      };

      for (const action of actions) {
        await this.executor.execute(action, params);
      }

      await this.itemStore.updateWritebackStatus(itemId, 'clean');
      return { status: 'success', actions };
    } catch (err) {
      await this.itemStore.updateWritebackStatus(itemId, 'error');
      return {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        actions,
      };
    }
  }
}
