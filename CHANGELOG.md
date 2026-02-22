# changelog

## 0.1.0

- initial release
- core: hashContent, hashBytes, putCAS, getCAS, hasCAS, storeRawAndMaterialized
- types: Item, Space, ItemDependency, ItemCategory, CreatedBy, WritebackStatus, DependencyType
- ltree: buildPath, parsePath, getDepth, getParentPath, getRootId, rebasePath
- dependencies: DependencyStore interface + helper functions
- writeback: parser, diff, mapper, registry, engine
- writeback schemas: linear-issue, linear-document, notion-page, confluence-page
