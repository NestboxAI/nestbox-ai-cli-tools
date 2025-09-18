import { Command } from "commander";
import chalk from "chalk";
import { resolveProject } from "../../utils/project";
import { loadNestboxConfig } from "../../utils/agent";
import { createApis, loadAgentFromYaml } from "./apiUtils";

type CreateAgentOptions = {
	agent: string; // agent name
	description: string;
	inputSchema: any;
	instance: string;
	project?: string;
	type?: string;
	prefix?: string;
};

type AgentCreateData = {
	type: string;
	agentName: string;
	goal: string;
	inputSchema: object;
	machineManifestId: string;
	projectId: string;
	machineName: string;
	machineInstanceId: number;
	instanceIP: string;
	userId: number;
	entryFunctionName: string;
	modelBaseId: string;
};

type MachineInstanceData = {
	machineId?: string;
	id?: number;
	internalIP?: string;
};

async function buildAgentData(
	options: CreateAgentOptions,
	machineInstanceData: MachineInstanceData = {}
): Promise<AgentCreateData> {
	const createAgentData = {
		agentName: "",
		goal: "",
		inputSchema: {},

		machineManifestId: machineInstanceData.machineId,
		machineName: options.instance,
		machineInstanceId: machineInstanceData.id,
		instanceIP: machineInstanceData.internalIP,

		projectId: options.project,
		type: options?.type || "REGULAR",
		userId: 0,
		modelBaseId: "",
		entryFunctionName: "",
	};

	// check agent name and add prefix
	if (!options.agent) {
		throw new Error("Missing required argument <agent>.");
	}
	createAgentData.agentName = options.prefix
		? options.prefix + "-" + options.agent
		: options.agent;

	// agent creation using arguments
	if (options.description || options.inputSchema) {
		if (!options.description) {
			throw new Error("Missing required argument <description>.");
		}
		if (!options.inputSchema) {
			throw new Error("Missing required argument <inputSchema>.");
		}
		createAgentData.goal = options.description;
		createAgentData.inputSchema = JSON.parse(options.inputSchema);
	} else {
		const manifestAgent = await loadAgentFromYaml(options.agent);

		if (!manifestAgent) {
			throw new Error(
				"Could not find a yaml file definition of an agent or agent not defined in yaml file."
			);
		}

		createAgentData.goal = manifestAgent.description;
		createAgentData.inputSchema = {};
		createAgentData.inputSchema = manifestAgent.inputSchema;

		createAgentData.type = options.type || manifestAgent?.type || "REGULAR";
	}

	return createAgentData as AgentCreateData;
}

export function registerCreateCommand(agentCommand: Command) {
	agentCommand
		.command("create")
		.description("Create an agent with direct arguments or YAML.")
		.option("--agent <agent>", "Agent name to deploy")
		.option(
			"--project <project>",
			"Project ID (defaults to current project)"
		)
		.option("--type <type>", "Agent type (e.g. CHAT, AGENT, REGULAR)")
		.option(
			"--prefix <prefix>",
			"A prefix added to beginning of the agent name."
		)
		.option("--description <description>", "Description of the agent")
		.option("--instance <instance>", "Machine name")
		.option("--inputSchema <inputSchema>", "Agent input schema")
		.action(async (options): Promise<any> => {
			try {
				const apis = createApis();

				// resolve project
				const projectData = await resolveProject(apis.projectsApi, {
					project: options?.project || "",
					instance: options?.instance || "",
					...options,
				});

				const projectRoot = process.cwd();
				const nestboxConfig = loadNestboxConfig(projectRoot);

				if (!options?.instance && !nestboxConfig?.instance) {
					console.log(
						chalk.red("Parameter <instance> not provided.")
					);
					return;
				}

				const machineName =
					options?.instance || nestboxConfig?.instance;

				const instanceData: any =
					await apis.instanceApi.machineInstancesControllerGetMachineInstanceByUserId(
						projectData.id,
						0,
						10
					);

				const targetInstance = instanceData.data.machineInstances.find(
					(instance: any) => instance.instanceName === machineName
				);

				if (!targetInstance) {
					console.error(
						chalk.red(
							`Instance with name "${machineName}" not found in project "${projectData.name}".`
						)
					);
					console.log(chalk.yellow("Available instances:"));
					instanceData.data.machineInstances.forEach(
						(instance: any) => {
							console.log(
								chalk.yellow(
									`  - ${instance.instanceName} (ID: ${instance.id})`
								)
							);
						}
					);
					return;
				}

				// build & validate merged payload
				const data = await buildAgentData(
					{ ...options, project: projectData.id },
					targetInstance
				);

				const response =
					await apis.agentsApi.machineAgentControllerCreateMachineAgent(
						projectData.id,
						{
							...data,
						}
					);

				console.log(chalk.green("Agent successfully created."));
				return response.data;
			} catch (error: any) {
				if (error.response && error.response.status === 401) {
					console.log(
						chalk.red(
							'Authentication token has expired. Please login again using "nestbox login <domain>".'
						)
					);
				} else if (error.response) {
					console.log(
						chalk.red(
							`API Error (${error.response.status}): ${error.response.data?.message || "Unknown error"}`
						)
					);
				} else {
					console.log(chalk.red(error.message || "Unknown error"));
				}
			}
		});
}
