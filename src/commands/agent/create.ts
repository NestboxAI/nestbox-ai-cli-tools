import { Command } from "commander";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { getAuthToken } from "../../utils/auth";
import { Configuration, MachineAgentApi, ProjectsApi } from "@nestbox-ai/admin";
import { resolveProject } from "../../utils/project";
import { loadNestboxConfig } from "../../utils/agent";

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
	machineInstanceId?: number;
	instanceIP?: string;
	machineManifestId?: string;
	userId?: number;
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
	configData: ConfigData = {}
): AgentCreateData {
	const merged = {
		type: options.type ?? manifestAgent?.type,
		agentName: (options.prefix + "-" || "") + agentName,
		goal: options.goal ?? manifestAgent?.goal,
		inputSchema: options.inputSchema ?? manifestAgent?.inputSchema,
		machineManifestId:
			options.machineManifestId ?? configData.machineManifestId,
		projectId: options.projectId,
		machineName: options.machineName ?? configData.machineName,
		machineInstanceId:
			options.machineInstanceId ?? configData.machineInstanceId,
		instanceIP: options.instanceIP ?? configData.instanceIP,
		userId: options.userId ?? configData.userId,
		entryFunctionName:
			options.entryFunctionName ?? manifestAgent?.entry ?? "",
		modelBaseId: options.modelBaseId ?? "",
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
		.option("--instanceName <instanceName>", "Name of the project instance")
		.option(
			"--machineManifestId <machineManifestId>",
			"Machine manifest ID"
		)
		.option("--type <type>", "Agent type (e.g. CHAT, AGENT, REGULAR)")
		.option(
			"--prefix <prefix>",
			"A prefix added to beginning of the agent name."
		)
		.option("--goal <goal>", "Goal/description of the agent")
		.option("--modelBaseId <modelBaseId>", "Model base ID")
		.option("--machineName <machineName>", "Machine name")
		.option(
			"--machineInstanceId <machineInstanceId>",
			"Machine instance ID",
			v => parseInt(v, 10)
		)
		.option("--instanceIP <instanceIP>", "Instance IP address")
		.option("--inputSchema <inputSchema>", "Agent input schema")
		.option("--userId <userId>", "User ID", v => parseInt(v, 10))
		.action(async (agentName, options): Promise<any> => {
			const authToken = getAuthToken();
			if (!authToken) {
				throw new Error(
					"No authentication token found. Please login first."
				);
			}

			const configuration = new Configuration({
				basePath: authToken.serverUrl,
				baseOptions: { headers: { Authorization: authToken.token } },
			});

			const projectsApi = new ProjectsApi(configuration);
			const agentsApi = new MachineAgentApi(configuration);

			// resolve project (your .option uses --project, not --projectId)
			const projectData = await resolveProject(projectsApi, {
				project: options.projectId,
				instance: options.instanceName || "",
				...options,
			});

			// read YAML (if present) for this agent
			const manifestAgent = await loadAgentFromManifest(agentName);
			const projectRoot = process.cwd();
			const configData = loadNestboxConfig(projectRoot);

			// build & validate merged payload
			const data = buildAgentData(
				agentName,
				{ ...options, projectId: projectData.id },
				manifestAgent,
				configData
			);

			// call API
			try {
				const response =
					await agentsApi.machineAgentControllerCreateMachineAgent(
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
