import { jest } from '@jest/globals';
import { putCAS, getCAS, hasCAS } from '../src/cas.js';

// Mock R2Bucket
function createMockBucket(): R2Bucket {
  const store = new Map<string, ArrayBuffer>();

  return {
    head: async (key: string) => {
      return store.has(key) ? ({} as R2Object) : null;
    },
    put: async (key: string, value: ArrayBuffer | ReadableStream | string | null) => {
      if (value instanceof ArrayBuffer) {
        store.set(key, value);
      }
      return {} as R2Object;
    },
    get: async (key: string) => {
      const data = store.get(key);
      if (!data) return null;
      return {
        body: new ReadableStream(),
        text: async () => new TextDecoder().decode(data),
        arrayBuffer: async () => data,
        blob: async () => new Blob([data]),
        json: async () => JSON.parse(new TextDecoder().decode(data)),
      } as unknown as R2ObjectBody;
    },
    delete: async () => {},
    list: async () => ({ objects: [], truncated: false, cursor: '' } as unknown as R2Objects),
    createMultipartUpload: async () => ({} as R2MultipartUpload),
    resumeMultipartUpload: () => ({} as R2MultipartUpload),
  } as unknown as R2Bucket;
}

describe('putCAS', () => {
  it('stores string content and returns hash + size', async () => {
    const bucket = createMockBucket();
    const result = await putCAS(bucket, 'hello world');
    expect(result.hash).toHaveLength(64);
    expect(result.size).toBeGreaterThan(0);
  });

  it('deduplicates identical content', async () => {
    const bucket = createMockBucket();
    const putSpy = jest.spyOn(bucket, 'put');

    const result1 = await putCAS(bucket, 'same content');
    const result2 = await putCAS(bucket, 'same content');

    expect(result1.hash).toBe(result2.hash);
    // First call writes, second call skips (head returns truthy)
    expect(putSpy).toHaveBeenCalledTimes(1);
  });

  it('stores Uint8Array content', async () => {
    const bucket = createMockBucket();
    const data = new TextEncoder().encode('binary data');
    const result = await putCAS(bucket, data);
    expect(result.hash).toHaveLength(64);
    expect(result.size).toBe(data.byteLength);
  });
});

describe('getCAS', () => {
  it('returns stored content', async () => {
    const bucket = createMockBucket();
    const { hash } = await putCAS(bucket, 'test content');
    const result = await getCAS(bucket, hash);
    expect(result).not.toBeNull();
  });

  it('returns null for missing hash', async () => {
    const bucket = createMockBucket();
    const result = await getCAS(bucket, 'nonexistent');
    expect(result).toBeNull();
  });
});

describe('hasCAS', () => {
  it('returns true for existing content', async () => {
    const bucket = createMockBucket();
    const { hash } = await putCAS(bucket, 'test');
    expect(await hasCAS(bucket, hash)).toBe(true);
  });

  it('returns false for missing hash', async () => {
    const bucket = createMockBucket();
    expect(await hasCAS(bucket, 'nonexistent')).toBe(false);
  });
});
