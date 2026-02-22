/**
 * Path helpers for PostgreSQL ltree columns
 *
 * Stores full ancestor chain as entry IDs:
 *   root (id: AAA) -> path: "AAA"
 *   folder (id: BBB) -> path: "AAA.BBB"
 *   file (id: CCC) -> path: "AAA.BBB.CCC"
 *
 * SQL queries stay product-specific. These helpers handle path construction.
 */

/**
 * Create child path by appending id to parent path
 * For root items (no parent), returns just the id
 */
export function buildPath(parentPath: string | null, id: string): string {
  if (!parentPath) return id;
  return `${parentPath}.${id}`;
}

/**
 * Split path into array of IDs
 */
export function parsePath(path: string): string[] {
  return path.split('.');
}

/**
 * Count depth levels (1-based: root = 1)
 */
export function getDepth(path: string): number {
  return path.split('.').length;
}

/**
 * Get parent path, or null for root items
 */
export function getParentPath(path: string): string | null {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return null;
  return path.slice(0, lastDot);
}

/**
 * Get the root ID (first segment)
 */
export function getRootId(path: string): string {
  const dot = path.indexOf('.');
  return dot === -1 ? path : path.slice(0, dot);
}

/**
 * Rewrite paths on move: replace oldPrefix with newPrefix
 * Used for subtree moves: UPDATE items SET path = rebasePath(path, oldPath, newPath)
 */
export function rebasePath(path: string, oldPrefix: string, newPrefix: string): string {
  if (path === oldPrefix) return newPrefix;
  if (!path.startsWith(oldPrefix + '.')) return path;
  return newPrefix + path.slice(oldPrefix.length);
}
