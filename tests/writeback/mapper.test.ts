import { parseConnectorMarkdown } from '../../src/writeback/parser.js';
import { diffDocuments } from '../../src/writeback/diff.js';
import { mapChangesToActions } from '../../src/writeback/mapper.js';
import { LINEAR_ISSUE_SCHEMA } from '../../src/writeback/schemas/linear-issue.js';
import type { LookupResolver, TransformRegistry } from '../../src/writeback/types.js';

const mockResolver: LookupResolver = {
  resolve: async (_entity, _field, value) => {
    if (Array.isArray(value)) return value.map(v => `resolved_${v}`);
    return `resolved_${value}`;
  },
};

const mockTransforms: TransformRegistry = {
  transform: (fnName, value) => {
    if (fnName === 'priorityLabelToNumber') {
      const map: Record<string, number> = { Urgent: 1, High: 2, Medium: 3, Low: 4 };
      return map[String(value)] ?? 0;
    }
    return value;
  },
};

function makeMd(overrides: Record<string, string> = {}): string {
  return `---
title: Test Issue
source: linear
source_ref: abc123
linear:
  state: ${overrides.state ?? 'In Progress'}
  priority_label: ${overrides.priority_label ?? 'High'}
---

# ${overrides.title ?? 'Test Issue'}

## Description

${overrides.description ?? 'Original description.'}
`;
}

describe('mapChangesToActions', () => {
  it('returns empty for no changes', async () => {
    const md = makeMd();
    const base = parseConnectorMarkdown(md, LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(md, LINEAR_ISSUE_SCHEMA);
    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    const actions = await mapChangesToActions(diff, LINEAR_ISSUE_SCHEMA, mockResolver, mockTransforms);
    expect(actions).toHaveLength(0);
  });

  it('maps title change to update_entity', async () => {
    const base = parseConnectorMarkdown(makeMd(), LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(makeMd({ title: 'New Title' }), LINEAR_ISSUE_SCHEMA);
    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    const actions = await mapChangesToActions(diff, LINEAR_ISSUE_SCHEMA, mockResolver, mockTransforms);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('update_entity');
    expect(actions[0].updateFields?.title).toBe('New Title');
  });

  it('resolves lookup fields', async () => {
    const base = parseConnectorMarkdown(makeMd(), LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(makeMd({ state: 'Done' }), LINEAR_ISSUE_SCHEMA);
    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    const actions = await mapChangesToActions(diff, LINEAR_ISSUE_SCHEMA, mockResolver, mockTransforms);

    expect(actions).toHaveLength(1);
    expect(actions[0].updateFields?.stateId).toBe('resolved_Done');
  });

  it('applies transform functions', async () => {
    const base = parseConnectorMarkdown(makeMd(), LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(makeMd({ priority_label: 'Urgent' }), LINEAR_ISSUE_SCHEMA);
    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    const actions = await mapChangesToActions(diff, LINEAR_ISSUE_SCHEMA, mockResolver, mockTransforms);

    expect(actions).toHaveLength(1);
    expect(actions[0].updateFields?.priority).toBe(1);
  });

  it('batches multiple field changes into one update_entity', async () => {
    const base = parseConnectorMarkdown(makeMd(), LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(
      makeMd({ title: 'New Title', state: 'Done', description: 'New desc.' }),
      LINEAR_ISSUE_SCHEMA,
    );
    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    const actions = await mapChangesToActions(diff, LINEAR_ISSUE_SCHEMA, mockResolver, mockTransforms);

    const updateActions = actions.filter(a => a.type === 'update_entity');
    expect(updateActions).toHaveLength(1);
    expect(updateActions[0].updateFields?.title).toBe('New Title');
    expect(updateActions[0].updateFields?.stateId).toBe('resolved_Done');
    expect(updateActions[0].updateFields?.description).toBe('New desc.');
  });
});
