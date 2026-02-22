// Core utilities
export { hashContent, hashBytes } from './hash.js';
export { putCAS, getCAS, hasCAS } from './cas.js';
export { storeRawAndMaterialized } from './store.js';
export type { StoreResult } from './store.js';

// Types
export type {
  ItemCategory,
  CreatedBy,
  WritebackStatus,
  DependencyType,
  Item,
  Space,
  ItemDependency,
} from './types.js';

// ltree helpers
export {
  buildPath,
  parsePath,
  getDepth,
  getParentPath,
  getRootId,
  rebasePath,
} from './ltree.js';

// Dependency tracking
export type { DependencyStore } from './dependencies.js';
export {
  recordDependencies,
  getDependencies,
  getReverseDependencies,
  markDependentsStale,
  clearDependencies,
  finalizeMaterialization,
} from './dependencies.js';
