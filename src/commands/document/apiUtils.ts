import { Configuration, DocumentsApi, ProjectsApi } from "@nestbox-ai/admin";
import { setupAuthAndConfig, type AuthResult } from "../../utils/api";

export interface DocumentApiInstances {
  documentsApi: DocumentsApi;
  projectsApi: ProjectsApi;
}

/**
 * Create API instances with current authentication using setupAuthAndConfig
 */
export function createDocumentApis(): DocumentApiInstances {
  const authResult = setupAuthAndConfig();
  if (!authResult) {
    throw new Error('No authentication token found. Please log in first.');
  }

  return {
    documentsApi: new DocumentsApi(authResult.configuration),
    projectsApi: new ProjectsApi(authResult.configuration)
  };
}
