import { DocumentProcessingApi, ProjectsApi } from '@nestbox-ai/admin';
import { setupAuthAndConfig } from '../../utils/api';

export interface DocProcApiInstances {
  documentProcessingApi: DocumentProcessingApi;
  projectsApi: ProjectsApi;
}

export function createDocProcApis(): DocProcApiInstances | null {
  const authResult = setupAuthAndConfig();
  if (!authResult) {
    return null;
  }

  return {
    documentProcessingApi: new DocumentProcessingApi(authResult.configuration),
    projectsApi: new ProjectsApi(authResult.configuration),
  };
}
