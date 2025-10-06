import {
	MachineInstancesApi,
	MiscellaneousApi,
	ProjectsApi,
} from "@nestbox-ai/admin";
import { setupAuthAndConfig } from "../../utils/api";

export interface ComputeApiInstances {
	machineInstanceApi: MachineInstancesApi;
	miscellaneousApi: MiscellaneousApi;
	projectsApi: ProjectsApi;
	authData: any;
}

/**
 * Create API instances for compute commands using setupAuthAndConfig
 */
export async function createComputeApis(): Promise<ComputeApiInstances | null> {
	const authResult = await await setupAuthAndConfig();
	if (!authResult) {
		return null;
	}

	const { authData, configuration } = authResult;

	return {
		machineInstanceApi: new MachineInstancesApi(configuration),
		miscellaneousApi: new MiscellaneousApi(configuration),
		projectsApi: new ProjectsApi(configuration),
		authData,
	};
}
