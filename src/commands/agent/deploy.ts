import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import path from "path";
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
import {
	createApis,
	loadAgentFromYaml,
	loadAllAgentNamesFromYaml,
} from "./apiUtils";
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
	entryFunctionName?: string;
	modelBaseId?: string;
	prefix?: string;
};

type DeployAgentOptions = {
	agent: string; // agent name
	description?: string;
	inputSchema?: any;
	instance: string;
	project?: string;
	type?: string;
	prefix?: string;
	all?: boolean;
	entryFunction: string;
	log?: boolean;
	silent?: boolean;
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
};

type MachineInstanceData = {
	machineId?: string;
	id?: number;
	internalIP?: string;
};

async function buildAgentData(
	options: DeployAgentOptions,
	machineInstanceData: MachineInstanceData = {}
): Promise<AgentCreateData> {
	const deployAgentData = {
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

	if (!options.agent) {
		throw new Error("Missing required argument <agent>.");
	}
	deployAgentData.agentName = options.prefix
		? options.prefix + "-" + options.agent
		: options.agent;

	if (options.description || options.inputSchema || options.entryFunction) {
		if (!options.description) {
			throw new Error("Missing required argument <description>.");
		}
		if (!options.inputSchema) {
			throw new Error("Missing required argument <inputSchema>.");
		}
		if (!options.entryFunction) {
			throw new Error("Missing required argument <entryFunction>.");
		}
		deployAgentData.goal = options.description;
		deployAgentData.inputSchema = JSON.parse(options.inputSchema);
		deployAgentData.entryFunctionName = options.entryFunction;
	} else {
		const manifestAgent = await loadAgentFromYaml(options.agent);

		if (!manifestAgent) {
			throw new Error(
				"Could not find a yaml file definition of an agent or agent not defined in yaml file."
			);
		}

		deployAgentData.entryFunctionName = manifestAgent.entry;
		deployAgentData.goal = manifestAgent.description;
		deployAgentData.inputSchema = manifestAgent.inputSchema || {};
		deployAgentData.type = options.type || manifestAgent?.type || "REGULAR";
	}

	return deployAgentData as AgentCreateData;
}

export function registerDeployCommand(agentCommand: Command) {
	agentCommand
		.command("deploy")
		.description("Deploy an AI agent to the Nestbox platform")
		.option(
			"--prefix <prefix>",
			"A prefix added to beginning of the agent name."
		)
		.option("--agent <agent>", "Agent name to deploy")
		.option("--description <description>", "Goal/description of the agent")
		.option("--inputSchema <inputSchema>", "Agent input schema")
		.option(
			"--project <project>",
			"Project ID (defaults to current project)"
		)
		.option("--type <type>", "Agent type (e.g. CHAT, AGENT, REGULAR)")
		.option("--entryFunction <entryFunction>", "Entry function name")
		.option("--instance <instance>", "Machine name")
		.option("--log", "Show detailed logs during deployment")
		.option("--silent", "Disable automatic agent creation.")
		.option("--all", "Deploy all agents defined in nestbox-agents.yaml")
		.action(async (options): Promise<any> => {
			try {
				let apis = createApis();

				await withTokenRefresh(
					async () => {
						let names: string[] = [];
						if (options.all) {
							names = await loadAllAgentNamesFromYaml();
							if (!names.length) {
								console.log(
									chalk.yellow(
										"No agents found in YAML manifest."
									)
								);
								return;
							}
						} else {
							if (!options?.agent) {
								console.log(
									chalk.red("Parameter <agent> not provided.")
								);
								return;
							}
							names = [options.agent];
						}

						const projectData = await resolveProject(
							apis.projectsApi,
							{
								project: options.project,
								instance: "",
								...options,
							}
						);

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

						for (const name of names) {
							const data = await buildAgentData(
								{
									...options,
									project: projectData.id,
									instance: machineName,
									agent: name,
								},
								targetInstance
							);

							const agentsData: any =
								await apis.agentsApi.machineAgentControllerGetMachineAgentByProjectId(
									projectData.id,
									0,
									100,
									data.type
								);

							let targetAgent =
								agentsData.data.machineAgents.find(
									(agent: any) =>
										agent.agentName === data.agentName
								);

							if (!targetAgent && !options.silent) {
								const { confirmCreation } =
									await inquirer.prompt([
										{
											type: "confirm",
											name: "confirmCreation",
											message: chalk.red(
												`No agent with specified name "${data.agentName}" found. Would you like to create one first before deployment?`
											),
											default: false,
										},
									]);

								if (!confirmCreation) {
									continue;
								}
							}

							if (!targetAgent) {
								const response =
									await apis.agentsApi.machineAgentControllerCreateMachineAgent(
										projectData.id,
										{ ...data }
									);

								targetAgent = response.data;

								console.log(
									chalk.green(
										`Created agent ${data.agentName} before deploying.`
									)
								);
							}

							const agentId = targetAgent.id;
							const resolvedEntry =
								data.entryFunctionName ||
								targetAgent.entryFunctionName ||
								"main";
							const instanceId = targetInstance.id;

							const spinner = ora(
								`Preparing to deploy ${data.agentName.toLowerCase()} ${agentId} to instance ${instanceId}...`
							).start();

							try {
								let zipFilePath;

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

								spinner.text = `Deploying ${data.agentName.toLowerCase()} ${agentId} to instance ${instanceId}...`;

								const authToken = getAuthToken();
								const baseUrl = authToken?.serverUrl?.endsWith(
									"/"
								)
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
								form.append(
									"machineAgentId",
									agentId.toString()
								);
								form.append(
									"instanceId",
									instanceId.toString()
								);
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
										chalk.blue(
											`  - Instance ID: ${instanceId}`
										)
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

								spinner.text = `Deploy ${name}...`;
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

								if (options.log) {
									console.log(
										chalk.blue("\nDeployment request:")
									);
									console.log(
										chalk.blue(
											`  URL: ${baseUrl}${endpoint}`
										)
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
									chalk.cyan(
										`📍 Instance: ${data.machineName}`
									)
								);
								console.log(
									chalk.cyan(`🤖 Agent: ${name} (${agentId})`)
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
									`Failed to deploy ${data.agentName.toLowerCase()} with Error: ${error.message || "Unknown error"}`
								);
							}
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
