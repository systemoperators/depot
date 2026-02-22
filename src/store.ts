/**
 * Raw + materialized storage helpers for connector workflows
 * Implements the two-layer model: raw API response + materialized content
 */

import { putCAS } from './cas.js';

export interface StoreResult {
  rawHash: string;
  materializedHash: string;
  contentHash: string;
}

/**
 * Store connector item raw data and materialized content
 *
 * @param bucket - R2 bucket for CAS storage
 * @param rawData - Raw API response object (will be JSON.stringify'd)
 * @param materializedContent - Generated content (markdown, CSV, etc.)
 * @param hashContent - Function to compute content hash
 * @returns Hashes for raw and materialized layers
 */
export async function storeRawAndMaterialized(
  bucket: R2Bucket,
  rawData: unknown,
  materializedContent: string,
  hashContent: (content: string) => Promise<string>
): Promise<StoreResult> {
  const rawJson = JSON.stringify(rawData);
  const rawResult = await putCAS(bucket, rawJson);

  const materializedResult = await putCAS(bucket, materializedContent);

  const contentHash = await hashContent(materializedContent);

  return {
    rawHash: rawResult.hash,
    materializedHash: materializedResult.hash,
    contentHash,
  };
}
