import { Command } from "commander";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { resolveProject } from "../../utils/project";
import { loadNestboxConfig } from "../../utils/agent";
import { createApis } from "./apiUtils";

type ManifestAgent = {
	name: string;
	goal: string;
	entry: string;
	inputSchema: any;
	type: string;
};

type CreateAgentOptions = {
	type?: string;
	goal?: string;
	inputSchema?: any;
	machineManifestId?: string;
	projectId?: string;
	machineName?: string;
	machineInstanceId?: number;
	instanceIP?: string;
	userId?: number;
	entryFunctionName?: string;
	modelBaseId?: string;
	prefix?: string;
};

type AgentCreateData = {
	type: string;
	agentName: string;
	goal: string;
	inputSchema: any;
	machineManifestId: string;
	projectId: string;
	machineName: string;
	machineInstanceId: number;
	instanceIP: string;
	userId: number;
	entryFunctionName: string;
	modelBaseId: string;
	parameters: [{}];
};

type ConfigData = {
	machineName?: string;
	userId?: number;
};

type MachineInstanceData = {
	machineId?: string;
	id?: number;
	internalIP?: string;
};

type ManifestFile = { agents: ManifestAgent[] };

async function loadAgentFromManifest(
	agentName: string
): Promise<ManifestAgent | undefined> {
	const file = path.join(process.cwd(), "nestbox-agents.yaml");

	try {
		await fs.access(file);
	} catch (err: any) {
		if (err?.code === "ENOENT") return undefined;
		throw new Error(`cannot access nestbox-agents.yaml: ${err.message}`);
	}

	const raw = await fs.readFile(file, "utf8");
	const doc = yaml.load(raw) as ManifestFile | undefined;

	if (!doc || !Array.isArray((doc as any)?.agents)) {
		throw new Error(
			`invalid nestbox-agets.yaml: root must contain an "agents" array`
		);
	}

	return doc.agents.find(a => a?.name === agentName);
}

function buildAgentData(
	agentName: string,
	options: CreateAgentOptions = {},
	manifestAgent?: ManifestAgent,
	configData: ConfigData = {},
	machineInstanceData: MachineInstanceData = {}
): AgentCreateData {
	const merged = {
		type: options.type ?? manifestAgent?.type,
		agentName: options.prefix
			? options.prefix + "-" + agentName
			: agentName,
		goal: options.goal ?? manifestAgent?.goal,
		inputSchema: options.inputSchema ?? manifestAgent?.inputSchema,
		machineManifestId: machineInstanceData.machineId,
		projectId: options.projectId,
		machineName: options.machineName ?? configData.machineName,
		machineInstanceId: machineInstanceData.id,
		instanceIP: machineInstanceData.internalIP,
		userId: options.userId ?? configData.userId,
		entryFunctionName:
			options.entryFunctionName ?? manifestAgent?.entry ?? "",
		modelBaseId: "",
		parameters: [{}] as [{}],
	};

	const required: (keyof AgentCreateData)[] = [
		"type",
		"agentName",
		"goal",
		"inputSchema",
		"machineManifestId",
		"projectId",
		"machineName",
		"machineInstanceId",
		"instanceIP",
		"userId",
	];

	const missing = required.filter(k => {
		const v = (merged as any)[k];
		return (
			v === undefined ||
			v === null ||
			(typeof v === "string" && v.trim?.() === "")
		);
	});

	if (missing.length) {
		throw new Error(
			`missing required fields: ${missing.join(", ")}. ` +
				`supply them via flags or add them to the "${agentName}" entry in nestbox-agents.yaml.`
		);
	}

	return merged as AgentCreateData;
}

export function registerCreateCommand(agentCommand: Command) {
	agentCommand
		.command("create <agentName>")
		.description("Create an agent with direct arguments or YAML.")
		.option(
			"--projectId <projectId>",
			"Project ID (defaults to current project)"
		)
		.option("--type <type>", "Agent type (e.g. CHAT, AGENT, REGULAR)")
		.option(
			"--prefix <prefix>",
			"A prefix added to beginning of the agent name."
		)
		.option("--goal <goal>", "Goal/description of the agent")
		.option("--machineName <machineName>", "Machine name")
		.option("--inputSchema <inputSchema>", "Agent input schema")
		.option("--userId <userId>", "User ID", v => parseInt(v, 10))
		.action(async (agentName, options): Promise<any> => {
			try {
				const apis = createApis();

				// resolve project (your .option uses --project, not --projectId)
				const projectData = await resolveProject(apis.projectsApi, {
					project: options.projectId,
					instance: options.machineName || "",
					...options,
				});

				// read YAML (if present) for this agent
				const manifestAgent = await loadAgentFromManifest(agentName);
				const projectRoot = process.cwd();
				const configData = loadNestboxConfig(projectRoot);

				const machineName =
					options.machineName || configData.machineName;

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
				const data = buildAgentData(
					agentName,
					{ ...options, projectId: projectData.id },
					manifestAgent,
					configData,
					targetInstance
				);

				const response =
					await apis.agentsApi.machineAgentControllerCreateMachineAgent(
						projectData.id,
						{ ...data }
					);

				console.log(chalk.green("Agent successfully created."));
				return response.data;
			} catch (error: any) {
				if (error.response && error.response.status === 401) {
					throw new Error(
						'Authentication token has expired. Please login again using "nestbox login <domain>".'
					);
				} else if (error.response) {
					throw new Error(
						`API Error (${error.response.status}): ${error.response.data?.message || "Unknown error"}`
					);
				} else {
					throw new Error(error.message || "Unknown error");
				}
			}
		});
}
