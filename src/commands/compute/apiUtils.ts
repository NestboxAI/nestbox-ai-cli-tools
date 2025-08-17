import { MachineInstancesApi, MiscellaneousApi, ProjectsApi } from "@nestbox-ai/admin";
import { setupAuthAndConfig } from "../../utils/api";

export interface ComputeApiInstances {
  machineInstanceApi: MachineInstancesApi;
  miscellaneousApi: MiscellaneousApi;
  projectsApi: ProjectsApi;
  authToken: any;
}

/**
 * Create API instances for compute commands using setupAuthAndConfig
 */
export function createComputeApis(): ComputeApiInstances | null {
  const authResult = setupAuthAndConfig();
  if (!authResult) {
    return null;
  }

  const { authToken, configuration } = authResult;

  return {
    machineInstanceApi: new MachineInstancesApi(configuration),
    miscellaneousApi: new MiscellaneousApi(configuration),
    projectsApi: new ProjectsApi(configuration),
    authToken
  };
}
