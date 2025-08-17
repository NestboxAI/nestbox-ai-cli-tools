import { Configuration, ProjectsApi } from "@nestbox-ai/admin";
import { setupAuthAndConfig, type AuthResult } from "../../utils/api";

export interface ApiInstances {
  projectsApi: ProjectsApi;
}

/**
 * Create API instances with current authentication using setupAuthAndConfig
 */
export function createApis(): ApiInstances {
  const authResult = setupAuthAndConfig();
  if (!authResult) {
    throw new Error('No authentication token found. Please log in first.');
  }

  return {
    projectsApi: new ProjectsApi(authResult.configuration),
  };
}
