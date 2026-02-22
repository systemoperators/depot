import type { DependencyStore } from '../src/dependencies.js';
import type { ItemDependency } from '../src/types.js';
import {
  recordDependencies,
  getDependencies,
  getReverseDependencies,
  markDependentsStale,
  clearDependencies,
  finalizeMaterialization,
} from '../src/dependencies.js';

interface MockStore extends DependencyStore {
  deps: ItemDependency[];
  staleIds: string[];
  notStaleId: string | null;
}

function createMockStore(): MockStore {
  const store: MockStore = {
    deps: [],
    staleIds: [],
    notStaleId: null,
    insertDependencies: async (deps: ItemDependency[]) => {
      store.deps.push(...deps);
    },
    getDependencies: async (itemId: string) => {
      return store.deps.filter(d => d.itemId === itemId);
    },
    getReverseDependencies: async (itemId: string) => {
      return store.deps.filter(d => d.dependsOnItemId === itemId);
    },
    deleteDependencies: async (itemId: string) => {
      store.deps = store.deps.filter(d => d.itemId !== itemId);
    },
    markItemsStale: async (itemIds: string[]) => {
      store.staleIds.push(...itemIds);
    },
    markItemNotStale: async (itemId: string) => {
      store.notStaleId = itemId;
    },
  };
  return store;
}

let idCounter = 0;
const generateId = () => `id_${++idCounter}`;

beforeEach(() => {
  idCounter = 0;
});

describe('recordDependencies', () => {
  it('records dependencies with correct fields', async () => {
    const store = createMockStore();
    const deps = await recordDependencies(store, 'item1', ['src1', 'src2'], 'source_data', generateId);
    expect(deps).toHaveLength(2);
    expect(deps[0].itemId).toBe('item1');
    expect(deps[0].dependsOnItemId).toBe('src1');
    expect(deps[0].dependencyType).toBe('source_data');
    expect(deps[1].dependsOnItemId).toBe('src2');
  });

  it('skips insert for empty source list', async () => {
    const store = createMockStore();
    const deps = await recordDependencies(store, 'item1', [], 'source_data', generateId);
    expect(deps).toHaveLength(0);
    expect(store.deps).toHaveLength(0);
  });
});

describe('getDependencies', () => {
  it('returns dependencies for item', async () => {
    const store = createMockStore();
    await recordDependencies(store, 'item1', ['src1'], 'source_data', generateId);
    const deps = await getDependencies(store, 'item1');
    expect(deps).toHaveLength(1);
  });
});

describe('getReverseDependencies', () => {
  it('returns items that depend on source', async () => {
    const store = createMockStore();
    await recordDependencies(store, 'item1', ['src1'], 'source_data', generateId);
    await recordDependencies(store, 'item2', ['src1'], 'source_data', generateId);
    const reverseDeps = await getReverseDependencies(store, 'src1');
    expect(reverseDeps).toHaveLength(2);
  });
});

describe('markDependentsStale', () => {
  it('marks dependent items as stale', async () => {
    const store = createMockStore();
    await recordDependencies(store, 'item1', ['src1'], 'source_data', generateId);
    await recordDependencies(store, 'item2', ['src1'], 'source_data', generateId);
    const count = await markDependentsStale(store, 'src1');
    expect(count).toBe(2);
    expect(store.staleIds).toEqual(['item1', 'item2']);
  });

  it('returns 0 when no dependents exist', async () => {
    const store = createMockStore();
    const count = await markDependentsStale(store, 'nobody');
    expect(count).toBe(0);
  });
});

describe('clearDependencies', () => {
  it('removes all dependencies for item', async () => {
    const store = createMockStore();
    await recordDependencies(store, 'item1', ['src1', 'src2'], 'source_data', generateId);
    await clearDependencies(store, 'item1');
    const deps = await getDependencies(store, 'item1');
    expect(deps).toHaveLength(0);
  });
});

describe('finalizeMaterialization', () => {
  it('clears old deps, records new, marks not stale', async () => {
    const store = createMockStore();
    await recordDependencies(store, 'item1', ['old_src'], 'source_data', generateId);
    await finalizeMaterialization(store, 'item1', ['new_src1', 'new_src2'], generateId);

    const deps = await getDependencies(store, 'item1');
    expect(deps).toHaveLength(2);
    expect(deps[0].dependsOnItemId).toBe('new_src1');
    expect(store.notStaleId).toBe('item1');
  });
});
