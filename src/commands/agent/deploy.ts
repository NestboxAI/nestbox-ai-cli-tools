import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { getAuthToken } from "../../utils/auth";
import { withTokenRefresh } from "../../utils/error";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import {
	createZipFromDirectory,
	isTypeScriptProject,
	loadNestboxConfig,
	runPredeployScripts,
} from "../../utils/agent";
import axios from "axios";
import { createApis } from "./apiUtils";
import inquirer from "inquirer";

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
	project?: string;
	instance?: string;
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
	instance?: string;
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
		await fs.accessSync(file);
	} catch (err: any) {
		if (err?.code === "ENOENT") return undefined;
		throw new Error(`cannot access nestbox-agents.yaml: ${err.message}`);
	}

	const raw = await fs.readFileSync(file, "utf8");
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
		projectId: options.project,
		machineName: options.instance ?? configData.instance,
		machineInstanceId: machineInstanceData.id,
		instanceIP: machineInstanceData.internalIP,
		userId: options.userId ?? configData.userId,
		entryFunctionName:
			options.entryFunctionName ?? manifestAgent?.entry ?? "",
		modelBaseId: "",
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
		"entryFunctionName",
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

export function registerDeployCommand(agentCommand: Command) {
	agentCommand
		.command("deploy")
		.description("Deploy an AI agent to the Nestbox platform")
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
		.option("--entryFunction <entryFunction>", "Entry function name")
		.option("--goal <goal>", "Goal/description of the agent")
		.option("--instance <instance>", "Machine name")
		.option("--inputSchema <inputSchema>", "Agent input schema")
		.option("--path <path>", "Path to the zip file or directory to upload")
		.option("--userId <userId>", "User ID", v => parseInt(v, 10))
		.option("--log", "Show detailed logs during deployment")
		.option("--silent", "Disable automatic agent creation.")
		.action(async (options): Promise<any> => {
			try {
				let apis = createApis();

				await withTokenRefresh(
					async () => {
						if (!options?.agent) {
							console.log(
								chalk.red("Parameter <agent> not provided.")
							);
							return;
						}
						// resolve project
						const projectData = await resolveProject(
							apis.projectsApi,
							{
								project: options.project,
								instance: "",
								...options,
							}
						);

						const manifestAgent = await loadAgentFromManifest(
							options.agent
						);

						if (!manifestAgent) {
							console.log(
								chalk.yellow(
									"No manifest agent found with this name."
								)
							);
						}
						const projectRoot = process.cwd();
						const config = loadNestboxConfig(projectRoot);

						if (!options?.instance && !config?.instance) {
							console.log(
								chalk.red("Parameter <instance> not provided.")
							);
							return;
						}

						const machineName = options.instance || config.instance;

						const instanceData: any =
							await apis.instanceApi.machineInstancesControllerGetMachineInstanceByUserId(
								projectData.id,
								0,
								10
							);

						const targetInstance =
							instanceData.data.machineInstances.find(
								(instance: any) =>
									instance.instanceName === machineName
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

						// build and validate merged payload
						const data = buildAgentData(
							options.agent,
							{ ...options, project: projectData.id },
							manifestAgent,
							config,
							targetInstance
						);

						const agentsData: any =
							await apis.agentsApi.machineAgentControllerGetMachineAgentByProjectId(
								projectData.id,
								0,
								10,
								data.type
							);

						let targetAgent = agentsData.data.machineAgents.find(
							(agent: any) => agent.agentName === data.agentName
						);

						if (!targetAgent && options.silent) {
							console.log(
								chalk.yellow(
									"No agent with specified name found. Please create one first."
								)
							);
							return;
						}

						if (!targetAgent) {
							const { confirmCreation } = await inquirer.prompt([
								{
									type: "confirm",
									name: "confirmCreation",
									message: chalk.red(
										"No such agent exists. Would you like to create one first before deployment?"
									),
									default: false,
								},
							]);

							if (!confirmCreation) {
								return;
							}

							const response =
								await apis.agentsApi.machineAgentControllerCreateMachineAgent(
									projectData.id,
									{ ...data }
								);

							targetAgent = response.data;

							console.log(
								chalk.green("Created agent before deploying.")
							);
						}

						// Extract IDs
						const agentId = targetAgent.id;
						const resolvedEntry =
							data.entryFunctionName ||
							targetAgent.entryFunctionName ||
							"main";
						const instanceId = targetInstance.id;

						// Start the deployment process
						const spinner = ora(
							`Preparing to deploy ${data.agentName.toLowerCase()} ${agentId} to instance ${instanceId}...`
						).start();

						try {
							let zipFilePath;
							let customZipPath = options.path;

							if (customZipPath) {
								// Process custom zip path
								if (!fs.existsSync(customZipPath)) {
									spinner.fail(
										`Path not found: ${customZipPath}`
									);
									return;
								}

								const stats = fs.statSync(customZipPath);

								if (stats.isFile()) {
									if (
										!customZipPath
											.toLowerCase()
											.endsWith(".zip")
									) {
										spinner.fail(
											`File is not a zip archive: ${customZipPath}`
										);
										return;
									}
									spinner.text = `Using provided zip file: ${customZipPath}`;
									zipFilePath = customZipPath;
								} else if (stats.isDirectory()) {
									// Process directory
									spinner.text = `Processing directory: ${customZipPath}`;

									const isTypeScript =
										isTypeScriptProject(customZipPath);

									if (
										isTypeScript &&
										(config?.agent?.predeploy ||
											config?.agents?.predeploy)
									) {
										const predeployScripts =
											config?.agent?.predeploy ||
											config?.agents?.predeploy;
										spinner.text = `Running predeploy scripts on target directory...`;
										await runPredeployScripts(
											predeployScripts,
											customZipPath
										);
									}

									spinner.text = `Creating zip archive from directory ${customZipPath}...`;
									zipFilePath =
										createZipFromDirectory(customZipPath);
									spinner.text = `Directory zipped successfully to ${zipFilePath}`;
								}
							} else {
								// Use project root
								spinner.text = `Using project root: ${projectRoot}`;

								const isTypeScript =
									isTypeScriptProject(projectRoot);

								if (
									isTypeScript &&
									(config?.agent?.predeploy ||
										config?.agents?.predeploy)
								) {
									const predeployScripts =
										config?.agent?.predeploy ||
										config?.agents?.predeploy;
									spinner.text = `Running predeploy scripts on project root...`;
									await runPredeployScripts(
										predeployScripts,
										projectRoot
									);
								}

								spinner.text = `Creating zip archive from project root ${projectRoot}...`;
								zipFilePath =
									createZipFromDirectory(projectRoot);
								spinner.text = `Directory zipped successfully to ${zipFilePath}`;
							}

							spinner.text = `Deploying ${data.agentName.toLowerCase()} ${agentId} to instance ${instanceId}...`;

							// Prepare deployment
							const authToken = getAuthToken();
							const baseUrl = authToken?.serverUrl?.endsWith("/")
								? authToken.serverUrl.slice(0, -1)
								: authToken?.serverUrl;

							const { default: FormData } = await import(
								"form-data"
							);
							const form = new FormData();

							form.append(
								"file",
								fs.createReadStream(zipFilePath)
							);
							form.append("machineAgentId", agentId.toString());
							form.append("instanceId", instanceId.toString());
							form.append("entryFunctionName", resolvedEntry);
							form.append("isSourceCodeUpdate", "true");
							form.append("projectId", projectData.id);

							if (options.log) {
								console.log(chalk.blue("Form Details "));
								console.log(
									chalk.blue(
										`  - File: ${path.basename(zipFilePath)}`
									)
								);
								console.log(
									chalk.blue(`  - Agent ID: ${agentId}`)
								);
								console.log(
									chalk.blue(`  - Instance ID: ${instanceId}`)
								);
								console.log(
									chalk.blue(
										`  - Entry Function: ${resolvedEntry}`
									)
								);
								console.log(
									chalk.blue(
										`  - Project ID: ${projectData.id}`
									)
								);
							}

							const axiosInstance = axios.create({
								baseURL: baseUrl,
								headers: {
									...form.getHeaders(),
									Authorization: authToken?.token,
								},
							});

							const endpoint = `/projects/${projectData.id}/agents/${agentId}`;

							spinner.text = `Deploy ${options.agent}...`;
							const res = await axiosInstance.patch(
								endpoint,
								form
							);

							await axios.patch(
								baseUrl + endpoint,
								{
									projectId: data.projectId,
									id: agentId,
									agentName: data.agentName,
									goal: data.goal,
									inputSchema: data.inputSchema,
								},
								{
									headers: {
										Authorization: authToken?.token,
									},
								}
							);

							if (
								!customZipPath &&
								zipFilePath &&
								fs.existsSync(zipFilePath)
							) {
								fs.unlinkSync(zipFilePath);
							}

							if (options.log) {
								console.log(
									chalk.blue("\nDeployment request:")
								);
								console.log(
									chalk.blue(`  URL: ${baseUrl}${endpoint}`)
								);
								console.log(chalk.blue(`  Method: PATCH`));
								console.log(
									chalk.blue(
										`  File: ${path.basename(zipFilePath)}`
									)
								);
								console.log(
									chalk.blue(
										`  Response status: ${res.status} ${res.statusText}`
									)
								);
								const lines = res.data.logEntries || [];
								console.log(
									chalk.blue(
										`  Deployment log entries (${lines.length} lines):`
									)
								);
								lines.forEach((line: any) => {
									console.log(
										chalk.blue(
											`    - [${line.type} ${line.timestamp}] ${line.message} `
										)
									);
								});
							}
							spinner.succeed("Successfully deployed");
							console.log(
								chalk.green(
									`${data.agentName} deployed successfully!`
								)
							);
							console.log(
								chalk.cyan(`📍 Instance: ${data.machineName}`)
							);
							console.log(
								chalk.cyan(
									`🤖 Agent: ${options.agent} (${agentId})`
								)
							);
							console.log(
								chalk.cyan(`⚙️ Entry: ${resolvedEntry}`)
							);
							console.log(
								chalk.cyan(
									`🔄 Process: ${res.data.processName}`
								)
							);
						} catch (error: any) {
							spinner.fail(
								`Failed to deploy ${data.agentName.toLowerCase()}`
							);
							throw error;
						}
					},
					() => {
						apis = createApis();
					}
				);
			} catch (error: any) {
				if (error.message && error.message.includes("Authentication")) {
					console.error(chalk.red(error.message));
				} else if (error.response) {
					console.error(
						chalk.red(
							`API Error (${error.response.status}): ${error.response.data?.message || "Unknown error"}`
						)
					);
					if (error.response.data) {
						console.error(
							chalk.red(
								`Error Data: ${JSON.stringify(error.response.data, null, 2)}`
							)
						);
					}
				} else {
					console.error(
						chalk.red("Error:"),
						error.message || "Unknown error"
					);
				}
			}
		});
}
