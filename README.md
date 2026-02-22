# @systemoperator/depot

Content-addressable storage, item tracking, dependency management, and writeback engine.

## install

```bash
npm install @systemoperator/depot
```

## modules

### core (import from `@systemoperator/depot`)

- `hashContent(string)`, `hashBytes(ArrayBuffer)` - SHA-256 hashing via Web Crypto
- `putCAS(bucket, content)`, `getCAS(bucket, hash)`, `hasCAS(bucket, hash)` - content-addressable storage for R2
- `storeRawAndMaterialized(bucket, rawData, materializedContent, hashFn)` - store raw API response + materialized content
- `Item`, `Space`, `ItemDependency` - core type interfaces
- `DependencyStore` interface + helpers: `recordDependencies`, `getDependencies`, `getReverseDependencies`, `markDependentsStale`, `clearDependencies`, `finalizeMaterialization`

### ltree (import from `@systemoperator/depot/ltree`)

Path helpers for PostgreSQL ltree columns:
- `buildPath(parentPath, id)` - create child path
- `parsePath(path)` - split into ID array
- `getDepth(path)` - count levels
- `getParentPath(path)` - parent path or null for roots
- `getRootId(path)` - first segment
- `rebasePath(path, oldPrefix, newPrefix)` - rewrite paths on move

### writeback (import from `@systemoperator/depot/writeback`)

Bidirectional sync engine: parse edited content, diff against base, map to API actions.

- `parseConnectorMarkdown(content, schema)` - parse markdown with YAML frontmatter
- `diffDocuments(base, current, schema)` - semantic diff between two parsed documents
- `mapChangesToActions(diff, schema, resolver, transforms)` - convert changes to API actions
- `SchemaRegistry` class - register and query connector schemas
- `WritebackEngine` class - full pipeline with store interfaces
- built-in schemas: linear-issue, linear-document, notion-page, confluence-page

## usage

```typescript
import { hashContent, putCAS, buildPath } from '@systemoperator/depot';
import { WritebackEngine, createDefaultRegistry } from '@systemoperator/depot/writeback';
```

Consumers implement store interfaces (`DependencyStore`, `ItemStore`, `ContentStore`, `WritebackExecutor`) for their own DB layer.

## development

```bash
npm test       # run tests
npm run build  # compile TypeScript
```

## license

MIT
