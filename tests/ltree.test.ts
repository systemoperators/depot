import { buildPath, parsePath, getDepth, getParentPath, getRootId, rebasePath } from '../src/ltree.js';

describe('buildPath', () => {
  it('creates root path from null parent', () => {
    expect(buildPath(null, 'AAA')).toBe('AAA');
  });

  it('appends id to parent path', () => {
    expect(buildPath('AAA', 'BBB')).toBe('AAA.BBB');
  });

  it('builds deep paths', () => {
    expect(buildPath('AAA.BBB', 'CCC')).toBe('AAA.BBB.CCC');
  });
});

describe('parsePath', () => {
  it('splits root path', () => {
    expect(parsePath('AAA')).toEqual(['AAA']);
  });

  it('splits nested path', () => {
    expect(parsePath('AAA.BBB.CCC')).toEqual(['AAA', 'BBB', 'CCC']);
  });
});

describe('getDepth', () => {
  it('returns 1 for root', () => {
    expect(getDepth('AAA')).toBe(1);
  });

  it('returns correct depth for nested paths', () => {
    expect(getDepth('AAA.BBB')).toBe(2);
    expect(getDepth('AAA.BBB.CCC')).toBe(3);
  });
});

describe('getParentPath', () => {
  it('returns null for root', () => {
    expect(getParentPath('AAA')).toBeNull();
  });

  it('returns parent for nested path', () => {
    expect(getParentPath('AAA.BBB')).toBe('AAA');
    expect(getParentPath('AAA.BBB.CCC')).toBe('AAA.BBB');
  });
});

describe('getRootId', () => {
  it('returns id for root path', () => {
    expect(getRootId('AAA')).toBe('AAA');
  });

  it('returns first segment for nested path', () => {
    expect(getRootId('AAA.BBB.CCC')).toBe('AAA');
  });
});

describe('rebasePath', () => {
  it('rebases exact match', () => {
    expect(rebasePath('AAA.BBB', 'AAA.BBB', 'XXX.YYY')).toBe('XXX.YYY');
  });

  it('rebases child paths', () => {
    expect(rebasePath('AAA.BBB.CCC', 'AAA.BBB', 'XXX.YYY')).toBe('XXX.YYY.CCC');
  });

  it('leaves non-matching paths unchanged', () => {
    expect(rebasePath('DDD.EEE', 'AAA.BBB', 'XXX.YYY')).toBe('DDD.EEE');
  });

  it('does not rebase partial prefix matches', () => {
    expect(rebasePath('AAA.BBBCCC', 'AAA.BBB', 'XXX')).toBe('AAA.BBBCCC');
  });
});
