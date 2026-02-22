import { parseConnectorMarkdown } from '../../src/writeback/parser.js';
import { diffDocuments } from '../../src/writeback/diff.js';
import { LINEAR_ISSUE_SCHEMA } from '../../src/writeback/schemas/linear-issue.js';

function makeMd(overrides: { state?: string; title?: string; description?: string } = {}): string {
  const state = overrides.state ?? 'In Progress';
  const title = overrides.title ?? 'Test Issue';
  const description = overrides.description ?? 'Original description.';

  return `---
title: ${title}
source: linear
source_ref: abc123
linear:
  state: ${state}
  priority_label: High
---

# ${title}

## Description

${description}
`;
}

describe('diffDocuments', () => {
  it('detects no changes for identical documents', () => {
    const md = makeMd();
    const base = parseConnectorMarkdown(md, LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(md, LINEAR_ISSUE_SCHEMA);

    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    expect(diff.hasChanges).toBe(false);
    expect(diff.changes).toHaveLength(0);
  });

  it('detects title change', () => {
    const base = parseConnectorMarkdown(makeMd(), LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(makeMd({ title: 'Updated Title' }), LINEAR_ISSUE_SCHEMA);

    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    expect(diff.hasChanges).toBe(true);
    expect(diff.bodyChanges).toHaveLength(1);
    expect(diff.bodyChanges[0].type).toBe('title_changed');
    expect(diff.bodyChanges[0].newValue).toBe('Updated Title');
  });

  it('detects frontmatter field change', () => {
    const base = parseConnectorMarkdown(makeMd(), LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(makeMd({ state: 'Done' }), LINEAR_ISSUE_SCHEMA);

    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    expect(diff.hasChanges).toBe(true);
    expect(diff.frontmatterChanges).toHaveLength(1);
    expect(diff.frontmatterChanges[0].field).toBe('linear.state');
    expect(diff.frontmatterChanges[0].oldValue).toBe('In Progress');
    expect(diff.frontmatterChanges[0].newValue).toBe('Done');
  });

  it('detects description change', () => {
    const base = parseConnectorMarkdown(makeMd(), LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(makeMd({ description: 'New description.' }), LINEAR_ISSUE_SCHEMA);

    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    expect(diff.hasChanges).toBe(true);
    expect(diff.bodyChanges.some(c => c.type === 'description_changed')).toBe(true);
  });

  it('detects new comment', () => {
    const baseMd = makeMd() + `\n## Comments\n\n<!-- comment:c1 author:Alice date:2025-01-01 -->\n**Alice** (2025-01-01):\nOld comment.\n`;
    const currentMd = baseMd + `\n---\n\nNew comment here.\n`;

    const base = parseConnectorMarkdown(baseMd, LINEAR_ISSUE_SCHEMA);
    const current = parseConnectorMarkdown(currentMd, LINEAR_ISSUE_SCHEMA);

    const diff = diffDocuments(base, current, LINEAR_ISSUE_SCHEMA);
    expect(diff.commentChanges.some(c => c.type === 'comment_added')).toBe(true);
  });
});
