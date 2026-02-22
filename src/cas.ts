/**
 * Content-Addressable Storage (CAS) for R2
 *
 * All file content stored as cas/{sha256} blobs.
 * Dedup is automatic - same content = same hash = stored once.
 */

import { hashContent } from './hash.js';

export { hashContent };

/**
 * Store content in CAS. Returns hash and size.
 * Skips write if blob already exists (dedup).
 */
export async function putCAS(
  bucket: R2Bucket,
  content: string | ArrayBuffer | Uint8Array,
): Promise<{ hash: string; size: number }> {
  let data: Uint8Array;
  if (typeof content === 'string') {
    data = new TextEncoder().encode(content);
  } else if (content instanceof ArrayBuffer) {
    data = new Uint8Array(content);
  } else {
    data = content;
  }

  const buffer = data.buffer as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const key = `cas/${hash}`;
  const existing = await bucket.head(key);
  if (!existing) {
    await bucket.put(key, buffer);
  }

  return { hash, size: data.byteLength };
}

/**
 * Fetch content from CAS by hash.
 */
export async function getCAS(
  bucket: R2Bucket,
  hash: string,
): Promise<R2ObjectBody | null> {
  return bucket.get(`cas/${hash}`);
}

/**
 * Check if a CAS blob exists without fetching it.
 */
export async function hasCAS(
  bucket: R2Bucket,
  hash: string,
): Promise<boolean> {
  const head = await bucket.head(`cas/${hash}`);
  return head !== null;
}
