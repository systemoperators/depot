/**
 * Markdown parser for writeback
 * Inverts the format produced by issueToMarkdown() / fullPageToMarkdown()
 * Parses YAML frontmatter with nested connector namespace, body sections, and comments
 */

import type {
  ConnectorSchema,
  ParsedConnectorDocument,
  ParsedBaseFrontmatter,
  ParsedComment,
  ParsedBodySection,
  ParsedBlockId,
} from './types.js';

/**
 * Parse a connector markdown document into structured form
 */
export function parseConnectorMarkdown(
  content: string,
  schema: ConnectorSchema,
): ParsedConnectorDocument {
  const { frontmatter, body } = splitFrontmatter(content);
  const { base, connectorMeta } = parseFrontmatter(frontmatter, schema.frontmatterNamespace);
  const title = extractTitle(body);
  const description = extractSection(body, 'Description');
  const bodyContent = extractBodyContent(body);
  const comments = extractComments(body);
  const sections = extractSections(body);
  const blockIds = extractBlockIds(body);

  return {
    base,
    connectorMeta,
    title,
    description,
    bodyContent,
    comments,
    sections,
    blockIds,
  };
}

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: '', body: trimmed };
  }

  const endIndex = trimmed.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { frontmatter: '', body: trimmed };
  }

  const frontmatter = trimmed.slice(4, endIndex).trim();
  const body = trimmed.slice(endIndex + 4).trim();

  return { frontmatter, body };
}

function parseFrontmatter(
  yaml: string,
  namespace: string,
): { base: ParsedBaseFrontmatter; connectorMeta: Record<string, unknown> } {
  const base: ParsedBaseFrontmatter = {
    title: '',
    source: '',
    sourceRef: '',
    sourceUrl: '',
    created: '',
    updated: '',
    tags: [],
  };
  const connectorMeta: Record<string, unknown> = {};

  if (!yaml) return { base, connectorMeta };

  const lines = yaml.split('\n');
  let currentNamespace: string | null = null;
  let currentArrayKey: string | null = null;
  let currentArray: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);

    // Array item under a key
    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();
      if (currentArrayKey) {
        currentArray.push(value);
      }
      continue;
    }

    // Flush pending array
    if (currentArrayKey && !trimmed.startsWith('- ')) {
      flushArray(base, connectorMeta, currentNamespace, namespace, currentArrayKey, currentArray);
      currentArrayKey = null;
      currentArray = [];
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const rawValue = trimmed.slice(colonIndex + 1).trim();

    // Top-level key
    if (indent === 0) {
      currentNamespace = null;

      if (rawValue === '' || rawValue === undefined) {
        const nextLine = lines[i + 1];
        if (nextLine) {
          const nextTrimmed = nextLine.trim();
          if (nextTrimmed.startsWith('- ')) {
            currentArrayKey = key;
            currentArray = [];
          } else {
            currentNamespace = key;
          }
        }
      } else {
        setBaseField(base, key, rawValue);
      }
    } else if (indent > 0 && currentNamespace) {
      if (rawValue === '') {
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.trim().startsWith('- ')) {
          currentArrayKey = key;
          currentArray = [];
        }
      } else if (currentNamespace === namespace) {
        connectorMeta[key] = parseValue(rawValue);
      }
    }
  }

  // Flush any remaining array
  if (currentArrayKey) {
    flushArray(base, connectorMeta, currentNamespace, namespace, currentArrayKey, currentArray);
  }

  return { base, connectorMeta };
}

function flushArray(
  base: ParsedBaseFrontmatter,
  connectorMeta: Record<string, unknown>,
  currentNamespace: string | null,
  targetNamespace: string,
  key: string,
  arr: string[],
): void {
  if (currentNamespace === targetNamespace) {
    connectorMeta[key] = arr;
  } else if (currentNamespace === null) {
    if (key === 'tags') {
      base.tags = arr;
    }
  }
}

function setBaseField(base: ParsedBaseFrontmatter, key: string, value: string): void {
  switch (key) {
    case 'title': base.title = value; break;
    case 'source': base.source = value; break;
    case 'source_ref': base.sourceRef = value; break;
    case 'source_url': base.sourceUrl = value; break;
    case 'created': base.created = value; break;
    case 'updated': base.updated = value; break;
    case 'author': base.author = value; break;
  }
}

function parseValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function extractTitle(body: string): string {
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
  }
  return '';
}

function extractBodyContent(body: string): string | null {
  const lines = body.split('\n');
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('# ')) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx === -1) return null;

  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim() === '## Comments') {
      endIdx = i;
      break;
    }
  }

  const content = lines.slice(startIdx, endIdx).join('\n').trim();
  return content || null;
}

function extractSection(body: string, sectionName: string): string | null {
  const lines = body.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === `## ${sectionName}`) {
      inSection = true;
      continue;
    }

    if (inSection && (trimmed.startsWith('## ') || trimmed.startsWith('# '))) {
      break;
    }

    if (inSection) {
      if (trimmed.startsWith('<!-- section:') || trimmed.startsWith('<!-- block:')) continue;
      sectionLines.push(line);
    }
  }

  if (sectionLines.length === 0) return null;

  const content = sectionLines.join('\n').trim();
  return content || null;
}

function extractSections(body: string): ParsedBodySection[] {
  const sections: ParsedBodySection[] = [];
  const lines = body.split('\n');
  let currentHeading: string | null = null;
  let currentBlockId: string | undefined;
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) continue;

    if (trimmed.startsWith('## ')) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join('\n').trim(),
          blockId: currentBlockId,
        });
      }

      currentHeading = trimmed.slice(3).trim();
      currentBlockId = undefined;
      currentLines = [];
      continue;
    }

    if (currentHeading && trimmed.startsWith('<!-- section:')) {
      const match = trimmed.match(/<!-- section:(\S+)/);
      if (match) currentBlockId = match[1];
      continue;
    }

    if (currentHeading) {
      currentLines.push(line);
    }
  }

  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join('\n').trim(),
      blockId: currentBlockId,
    });
  }

  return sections;
}

function extractComments(body: string): ParsedComment[] {
  const comments: ParsedComment[] = [];
  const lines = body.split('\n');
  let inComments = false;
  let currentComment: Partial<ParsedComment> | null = null;
  let currentBodyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '## Comments') {
      inComments = true;
      continue;
    }

    if (inComments && (trimmed.startsWith('# ') || (trimmed.startsWith('## ') && trimmed !== '## Comments'))) {
      if (currentComment) {
        currentComment.body = currentBodyLines.join('\n').trim();
        comments.push(currentComment as ParsedComment);
      }
      break;
    }

    if (!inComments) continue;

    const commentMatch = trimmed.match(/^<!-- comment:(\S+)\s*(.*?)-->/);
    if (commentMatch) {
      if (currentComment) {
        currentComment.body = currentBodyLines.join('\n').trim();
        comments.push(currentComment as ParsedComment);
      }

      const id = commentMatch[1];
      const rest = commentMatch[2];

      const authorMatch = rest.match(/author:(\S+)/);
      const dateMatch = rest.match(/date:(\S+)/);

      currentComment = {
        id,
        author: authorMatch?.[1] ?? '',
        date: dateMatch?.[1] ?? '',
        isNew: false,
      };
      currentBodyLines = [];
      continue;
    }

    if (trimmed === '---') {
      if (currentComment) {
        currentComment.body = currentBodyLines.join('\n').trim();
        comments.push(currentComment as ParsedComment);
        currentComment = null;
        currentBodyLines = [];
      }
      continue;
    }

    if (currentComment && trimmed.startsWith('**')) {
      continue;
    }

    if (currentComment === null && trimmed && !trimmed.startsWith('*Last synced')) {
      currentComment = {
        id: null,
        author: '',
        date: '',
        body: '',
        isNew: true,
      };
      currentBodyLines = [line];
      continue;
    }

    if (currentComment) {
      currentBodyLines.push(line);
    }
  }

  if (currentComment) {
    currentComment.body = currentBodyLines.join('\n').trim();
    comments.push(currentComment as ParsedComment);
  }

  return comments;
}

function extractBlockIds(body: string): ParsedBlockId[] {
  const blockIds: ParsedBlockId[] = [];
  const pattern = /<!-- (\w+):(\S+)(.*?)-->/g;
  let match;

  while ((match = pattern.exec(body)) !== null) {
    const type = match[1];
    const id = match[2];
    const rest = match[3].trim();

    const metadata: Record<string, string> = {};
    const pairPattern = /(\w+):(\S+)/g;
    let pairMatch;
    while ((pairMatch = pairPattern.exec(rest)) !== null) {
      metadata[pairMatch[1]] = pairMatch[2];
    }

    blockIds.push({ type, id, metadata });
  }

  return blockIds;
}
