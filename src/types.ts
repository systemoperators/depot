/**
 * Shared types for the depot storage model
 * Used by ultrathink, bigmission, and any product needing item/file tracking
 */

export type ItemCategory = 'raw_data' | 'materialized' | 'user_content' | 'folder';

export type CreatedBy = 'user' | 'sync_workflow' | 'materialization_worker' | 'connector' | 'system';

export type WritebackStatus = 'clean' | 'pending' | 'writing' | 'conflict' | 'error';

export type DependencyType = 'source_data' | 'embedded_reference' | 'attachment';

/**
 * Item represents any file, folder, or data entity in the storage system
 */
export interface Item {
  id: string;
  spaceId: string;
  userId: string;
  parentId: string | null;
  name: string;
  slug: string | null;
  extension: string | null;
  type: string;
  mimeType: string | null;
  sizeBytes: number | null;

  // CAS hashes
  rawHash: string | null;
  contentHash: string | null;
  materializedHash: string | null;
  materializedPath: string | null;
  materializedVersion: number;
  materializedAt: Date | null;

  // Source metadata
  source: string;
  sourceRef: string | null;
  sourceUrl: string | null;
  sourceEditUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  connectionId: string | null;

  // Classification
  category: ItemCategory;
  createdBy: CreatedBy;

  // State flags
  isDerived: boolean;
  isStale: boolean;
  isPinned: boolean;
  isTrashed: boolean;
  currentVersion: number;
  writebackStatus: WritebackStatus;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Space represents a workspace/organization
 */
export interface Space {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tracks which items were used to create materialized items
 */
export interface ItemDependency {
  id: string;
  itemId: string;
  dependsOnItemId: string;
  dependencyType: DependencyType;
  addedAt: Date;
}
