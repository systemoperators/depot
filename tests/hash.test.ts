import { hashContent, hashBytes } from '../src/hash.js';

describe('hashContent', () => {
  it('returns consistent SHA-256 hex for same input', async () => {
    const hash1 = await hashContent('hello world');
    const hash2 = await hashContent('hello world');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('returns different hashes for different input', async () => {
    const hash1 = await hashContent('hello');
    const hash2 = await hashContent('world');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', async () => {
    const hash = await hashContent('');
    expect(hash).toHaveLength(64);
  });

  it('handles unicode', async () => {
    const hash = await hashContent('hello world');
    expect(hash).toHaveLength(64);
  });
});

describe('hashBytes', () => {
  it('returns consistent SHA-256 hex', async () => {
    const data = new TextEncoder().encode('hello world');
    const hash1 = await hashBytes(data.buffer as ArrayBuffer);
    const hash2 = await hashBytes(data.buffer as ArrayBuffer);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('matches hashContent for same string', async () => {
    const text = 'test content';
    const textHash = await hashContent(text);
    const bytesHash = await hashBytes(new TextEncoder().encode(text).buffer as ArrayBuffer);
    expect(textHash).toBe(bytesHash);
  });
});
