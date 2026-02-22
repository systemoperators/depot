/**
 * Dependency tracking for materialized items
 * Uses store interface pattern - products implement DependencyStore for their DB
 */

import type { ItemDependency, DependencyType } from './types.js';

/**
 * Store interface for dependency operations
 * Products implement this with their DB (drizzle, postgres.js, etc.)
 */
export interface DependencyStore {
  insertDependencies(deps: ItemDependency[]): Promise<void>;
  getDependencies(itemId: string): Promise<ItemDependency[]>;
  getReverseDependencies(itemId: string): Promise<ItemDependency[]>;
  deleteDependencies(itemId: string): Promise<void>;
  markItemsStale(itemIds: string[]): Promise<void>;
  markItemNotStale(itemId: string, materializedAt: Date): Promise<void>;
}

/**
 * Record dependencies for a materialized item
 */
export async function recordDependencies(
  store: DependencyStore,
  itemId: string,
  sourceItemIds: string[],
  dependencyType: DependencyType,
  generateId: () => string,
): Promise<ItemDependency[]> {
  const now = new Date();
  const deps: ItemDependency[] = sourceItemIds.map(sourceId => ({
    id: generateId(),
    itemId,
    dependsOnItemId: sourceId,
    dependencyType: dependencyType,
    addedAt: now,
  }));

  if (deps.length > 0) {
    await store.insertDependencies(deps);
  }

  return deps;
}

/**
 * Get all dependencies for an item (what it depends on)
 */
export async function getDependencies(
  store: DependencyStore,
  itemId: string,
): Promise<ItemDependency[]> {
  return store.getDependencies(itemId);
}

/**
 * Get reverse dependencies (what items depend on this one)
 */
export async function getReverseDependencies(
  store: DependencyStore,
  itemId: string,
): Promise<ItemDependency[]> {
  return store.getReverseDependencies(itemId);
}

/**
 * Mark dependent items as stale when source item changes
 */
export async function markDependentsStale(
  store: DependencyStore,
  sourceItemId: string,
): Promise<number> {
  const reverseDeps = await store.getReverseDependencies(sourceItemId);
  const dependentItemIds = reverseDeps.map(dep => dep.itemId);

  if (dependentItemIds.length === 0) return 0;

  await store.markItemsStale(dependentItemIds);
  return dependentItemIds.length;
}

/**
 * Clear all dependencies for an item
 */
export async function clearDependencies(
  store: DependencyStore,
  itemId: string,
): Promise<void> {
  await store.deleteDependencies(itemId);
}

/**
 * Full workflow: clear old deps, record new ones, mark item as not stale
 */
export async function finalizeMaterialization(
  store: DependencyStore,
  itemId: string,
  sourceItemIds: string[],
  generateId: () => string,
): Promise<void> {
  await store.deleteDependencies(itemId);
  await recordDependencies(store, itemId, sourceItemIds, 'source_data', generateId);
  await store.markItemNotStale(itemId, new Date());
}
