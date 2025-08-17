import { MachineAgentApi, MachineInstancesApi, ProjectsApi } from "@nestbox-ai/admin";
import { setupAuthAndConfig } from "../../utils/api";

export interface ApiInstances {
  agentsApi: MachineAgentApi;
  projectsApi: ProjectsApi;
  instanceApi: MachineInstancesApi;
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
    agentsApi: new MachineAgentApi(authResult.configuration),
    projectsApi: new ProjectsApi(authResult.configuration),
    instanceApi: new MachineInstancesApi(authResult.configuration)
  };
}
