import type { ConnectorSchema } from '../types.js';

export const LINEAR_DOCUMENT_SCHEMA: ConnectorSchema = {
  connector: 'linear',
  entityType: 'linear_document',
  frontmatterNamespace: 'linear',
  updateMethod: 'updateDocument',
  entityIdField: 'source_ref',
  connectionIdSource: 'item_connectionId',
  fields: [
    {
      markdownField: 'title',
      location: 'body_title',
      apiField: 'title',
      direction: 'readwrite',
      resolution: 'direct',
      valueType: 'string',
    },
    {
      markdownField: 'content',
      location: 'body_section',
      apiField: 'content',
      direction: 'readwrite',
      resolution: 'direct',
      valueType: 'string',
    },
    {
      markdownField: 'author',
      location: 'frontmatter',
      apiField: 'creator',
      direction: 'read',
      resolution: 'direct',
      valueType: 'string',
    },
    {
      markdownField: 'project',
      location: 'frontmatter',
      apiField: 'projectId',
      direction: 'readwrite',
      resolution: 'lookup',
      lookupEntity: 'project',
      lookupMatchField: 'name',
      valueType: 'string',
    },
  ],
};
