import { Configuration, MachineAgentApi, ProjectsApi } from "@nestbox-ai/admin";
import { getAuthToken } from "../../utils/auth";
import { resolveProject } from "../../utils/project";

export interface CreateAgentOptions {
  lang?: string;
  template?: string;
  project?: string;
  instanceName?: string;
  machineManifestId?: string;
  type?: string;
  goal?: string;
  modelBaseId?: string;
  machineName?: string;
  machineInstanceId?: number;
  instanceIP?: string;
  userId?: number;
  parameters?: Array<{name: string; description: string; default: any}>;
}

/**
 * Create a new agent in the Nestbox platform
 * 
 * @param agentName The name of the agent
 * @param options Options including lang, template, and project
 * @param agentsApi The MachineAgentApi instance
 * @param projectsApi The ProjectsApi instance
 */
export async function createAgent(
  agentName: string, 
  options: CreateAgentOptions,
  agentsApi?: MachineAgentApi,
  projectsApi?: ProjectsApi
): Promise<any> {
  const authToken = getAuthToken();
  if (!authToken) {
    throw new Error("No authentication token found. Please login first.");
  }

  // Create API instances if not provided
  if (!agentsApi || !projectsApi) {
    const configuration = new Configuration({
      basePath: authToken?.serverUrl,
      baseOptions: {
        headers: {
          Authorization: authToken?.token,
        },
      },
    });

    agentsApi = agentsApi || new MachineAgentApi(configuration);
    projectsApi = projectsApi || new ProjectsApi(configuration);
  }

  // Resolve project - convert options to match CommandOptions interface
  const projectData = await resolveProject(projectsApi, {
    project: options.project,
    instance: options.instanceName || '',
    ...options
  });

  // Prepare agent creation payload
  // Determine the correct type value based on options.type
  const agentTypeValue = options.type?.includes("AGENT") ? "REGULAR" : options.type || "CHAT";

  const payload: any = {
    agentName,
    goal: options.goal || `AI agent for ${agentName}`,
    modelBaseId: options.modelBaseId || "",
    machineName: options.machineName,
    machineInstanceId: options.machineInstanceId,
    instanceIP: options.instanceIP,
    machineManifestId: options.machineManifestId,
    parameters: options.parameters?.map((param: any) => ({
      name: param.name,
      description: param.description,
      default_value: param.default || "",
      isUserParam: param.isUserParam !== undefined ? param.isUserParam : true
    })) || [],
    projectId: projectData.id,
    type: agentTypeValue,
    userId: options.userId || 0,
  };

  // Determine the type of resource (Agent or Chat)
  const agentType = options.type || "CHAT";
  const resourceType = agentType === "AGENT" || agentType === "REGULAR" ? "Agent" : "Chatbot";

  // Create the agent
  try {
    const response = await agentsApi.machineAgentControllerCreateMachineAgent(
      projectData.id,
      payload
    );
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      throw new Error('Authentication token has expired. Please login again using "nestbox login <domain>".');
    } else if (error.response) {
      throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || "Unknown error"}`);
    } else {
      throw new Error(error.message || "Unknown error");
    }
  }
}
