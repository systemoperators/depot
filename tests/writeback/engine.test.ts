import { WritebackEngine } from '../../src/writeback/engine.js';
import type { ItemStore, ContentStore, ConflictDetector, WritebackExecutor } from '../../src/writeback/engine.js';
import type { Item, WritebackStatus } from '../../src/types.js';
import type { ApiAction } from '../../src/writeback/types.js';
import { LINEAR_ISSUE_SCHEMA } from '../../src/writeback/schemas/linear-issue.js';
import type { LookupResolver, TransformRegistry } from '../../src/writeback/types.js';

const baseMd = `---
title: Test Issue
source: linear
source_ref: abc123
linear:
  state: In Progress
  priority_label: High
---

# Test Issue

## Description

Original description.
`;

const editedMd = `---
title: Test Issue
source: linear
source_ref: abc123
linear:
  state: Done
  priority_label: High
---

# Test Issue

## Description

Original description.
`;

function createMockItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item1',
    spaceId: 'space1',
    userId: 'user1',
    parentId: null,
    name: 'test',
    slug: null,
    extension: 'md',
    type: 'linear_issue',
    mimeType: 'text/markdown',
    sizeBytes: 100,
    rawHash: 'raw123',
    contentHash: 'base_hash',
    materializedHash: 'edited_hash',
    materializedPath: null,
    materializedVersion: 1,
    materializedAt: new Date(),
    source: 'linear',
    sourceRef: 'abc123',
    sourceUrl: 'https://linear.app/issue/abc123',
    sourceEditUrl: null,
    entityType: 'linear_issue',
    entityId: 'abc123',
    connectionId: 'conn1',
    category: 'materialized',
    createdBy: 'sync_workflow',
    isDerived: false,
    isStale: false,
    isPinned: false,
    isTrashed: false,
    currentVersion: 1,
    writebackStatus: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const mockResolver: LookupResolver = {
  resolve: async (_entity, _field, value) => {
    if (Array.isArray(value)) return value.map(v => `resolved_${v}`);
    return `resolved_${value}`;
  },
};

const mockTransforms: TransformRegistry = {
  transform: (_fnName, value) => value,
};

describe('WritebackEngine', () => {
  it('returns error when item not found', async () => {
    const itemStore: ItemStore = {
      getItem: async () => null,
      updateWritebackStatus: async () => {},
    };
    const contentStore: ContentStore = { getContent: async () => null };
    const executor: WritebackExecutor = { execute: async () => {} };

    const engine = new WritebackEngine(itemStore, contentStore, null, executor, mockResolver, mockTransforms);
    const result = await engine.writeback('nonexistent', LINEAR_ISSUE_SCHEMA);
    expect(result.status).toBe('error');
    expect(result.error).toContain('not found');
  });

  it('detects conflict when conflictDetector reports one', async () => {
    const item = createMockItem();
    const statusUpdates: WritebackStatus[] = [];

    const itemStore: ItemStore = {
      getItem: async () => item,
      updateWritebackStatus: async (_id, status) => { statusUpdates.push(status); },
    };
    const contentStore: ContentStore = { getContent: async () => baseMd };
    const conflictDetector: ConflictDetector = {
      checkConflict: async () => ({ hasConflict: true, remoteUpdatedAt: '2025-01-02' }),
    };
    const executor: WritebackExecutor = { execute: async () => {} };

    const engine = new WritebackEngine(itemStore, contentStore, conflictDetector, executor, mockResolver, mockTransforms);
    const result = await engine.writeback('item1', LINEAR_ISSUE_SCHEMA);
    expect(result.status).toBe('conflict');
    expect(statusUpdates).toContain('conflict');
  });

  it('returns no_changes when content is identical', async () => {
    const item = createMockItem();

    const itemStore: ItemStore = {
      getItem: async () => item,
      updateWritebackStatus: async () => {},
    };
    const contentStore: ContentStore = { getContent: async () => baseMd };
    const executor: WritebackExecutor = { execute: async () => {} };

    const engine = new WritebackEngine(itemStore, contentStore, null, executor, mockResolver, mockTransforms);
    const result = await engine.writeback('item1', LINEAR_ISSUE_SCHEMA);
    expect(result.status).toBe('no_changes');
  });

  it('executes actions on success', async () => {
    const item = createMockItem();
    const statusUpdates: WritebackStatus[] = [];
    const executedActions: ApiAction[] = [];

    const itemStore: ItemStore = {
      getItem: async () => item,
      updateWritebackStatus: async (_id, status) => { statusUpdates.push(status); },
    };
    const contentStore: ContentStore = {
      getContent: async (hash) => hash === 'base_hash' ? baseMd : editedMd,
    };
    const executor: WritebackExecutor = {
      execute: async (action) => { executedActions.push(action); },
    };

    const engine = new WritebackEngine(itemStore, contentStore, null, executor, mockResolver, mockTransforms);
    const result = await engine.writeback('item1', LINEAR_ISSUE_SCHEMA);

    expect(result.status).toBe('success');
    expect(executedActions.length).toBeGreaterThan(0);
    expect(statusUpdates).toContain('writing');
    expect(statusUpdates[statusUpdates.length - 1]).toBe('clean');
  });

  it('sets error status on executor failure', async () => {
    const item = createMockItem();
    const statusUpdates: WritebackStatus[] = [];

    const itemStore: ItemStore = {
      getItem: async () => item,
      updateWritebackStatus: async (_id, status) => { statusUpdates.push(status); },
    };
    const contentStore: ContentStore = {
      getContent: async (hash) => hash === 'base_hash' ? baseMd : editedMd,
    };
    const executor: WritebackExecutor = {
      execute: async () => { throw new Error('API failure'); },
    };

    const engine = new WritebackEngine(itemStore, contentStore, null, executor, mockResolver, mockTransforms);
    const result = await engine.writeback('item1', LINEAR_ISSUE_SCHEMA);

    expect(result.status).toBe('error');
    expect(result.error).toBe('API failure');
    expect(statusUpdates[statusUpdates.length - 1]).toBe('error');
  });
});
