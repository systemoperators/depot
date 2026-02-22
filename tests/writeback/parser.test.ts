import { parseConnectorMarkdown } from '../../src/writeback/parser.js';
import { LINEAR_ISSUE_SCHEMA } from '../../src/writeback/schemas/linear-issue.js';
import { NOTION_PAGE_SCHEMA } from '../../src/writeback/schemas/notion-page.js';

describe('parseConnectorMarkdown', () => {
  it('parses frontmatter and body', () => {
    const md = `---
title: Test Issue
source: linear
source_ref: abc123
source_url: https://linear.app/issue/abc123
created: 2025-01-01
updated: 2025-01-02
linear:
  state: In Progress
  priority_label: High
  assignee: Alice
tags:
  - bug
  - urgent
---

# Test Issue

## Description

This is the description.

## Comments

<!-- comment:c1 author:Bob date:2025-01-01 -->
**Bob** (2025-01-01):
This is a comment.
`;

    const doc = parseConnectorMarkdown(md, LINEAR_ISSUE_SCHEMA);

    expect(doc.base.title).toBe('Test Issue');
    expect(doc.base.source).toBe('linear');
    expect(doc.base.sourceRef).toBe('abc123');
    expect(doc.base.tags).toEqual(['bug', 'urgent']);
    expect(doc.connectorMeta.state).toBe('In Progress');
    expect(doc.connectorMeta.priority_label).toBe('High');
    expect(doc.connectorMeta.assignee).toBe('Alice');
    expect(doc.title).toBe('Test Issue');
    expect(doc.description).toBe('This is the description.');
    expect(doc.comments).toHaveLength(1);
    expect(doc.comments[0].id).toBe('c1');
    expect(doc.comments[0].author).toBe('Bob');
  });

  it('parses body content for Notion pages', () => {
    const md = `---
title: My Page
source: notion
source_ref: page123
---

# My Page

Some body content here.

More content.
`;

    const doc = parseConnectorMarkdown(md, NOTION_PAGE_SCHEMA);
    expect(doc.title).toBe('My Page');
    expect(doc.bodyContent).toContain('Some body content here.');
    expect(doc.bodyContent).toContain('More content.');
  });

  it('handles missing frontmatter', () => {
    const md = `# Just a Title

Some content.
`;

    const doc = parseConnectorMarkdown(md, LINEAR_ISSUE_SCHEMA);
    expect(doc.title).toBe('Just a Title');
    expect(doc.base.title).toBe('');
  });

  it('parses block ID comments', () => {
    const md = `---
title: Test
source: notion
---

# Test

<!-- block:abc123 type:paragraph -->
Some text.
`;

    const doc = parseConnectorMarkdown(md, NOTION_PAGE_SCHEMA);
    expect(doc.blockIds).toHaveLength(1);
    expect(doc.blockIds[0].id).toBe('abc123');
    expect(doc.blockIds[0].type).toBe('block');
  });

  it('detects new comments without ID marker', () => {
    const md = `---
title: Test
source: linear
---

# Test

## Comments

<!-- comment:c1 author:Alice date:2025-01-01 -->
**Alice** (2025-01-01):
Old comment.

---

This is a new comment by the user.
`;

    const doc = parseConnectorMarkdown(md, LINEAR_ISSUE_SCHEMA);
    expect(doc.comments).toHaveLength(2);
    expect(doc.comments[0].isNew).toBe(false);
    expect(doc.comments[1].isNew).toBe(true);
    expect(doc.comments[1].body).toBe('This is a new comment by the user.');
  });
});
