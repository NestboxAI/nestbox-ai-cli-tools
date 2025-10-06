import { MiscellaneousApi, ProjectsApi } from "@nestbox-ai/admin";
import { setupAuthAndConfig } from "../../utils/api";

export interface ApiInstances {
	miscellaneousApi: MiscellaneousApi;
	projectsApi: ProjectsApi;
}

/**
 * Create API instances with current authentication using setupAuthAndConfig
 */
export async function createApis(): Promise<ApiInstances> {
	const authResult = await setupAuthAndConfig();
	if (!authResult) {
		throw new Error("No authentication token found. Please log in first.");
	}

	return {
		miscellaneousApi: new MiscellaneousApi(authResult.configuration),
		projectsApi: new ProjectsApi(authResult.configuration),
	};
}
