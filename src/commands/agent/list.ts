import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { resolveProject } from "../../utils/project";
import { AgentType } from "../../types/agentType";
import { createApis } from "./apiUtils";

export function registerListCommand(agentCommand: Command): void {
	agentCommand
		.command("list")
		.description(
			"List all AI agents associated with the authenticated user"
		)
		.option(
			"--project <projectName>",
			"Project name (defaults to the current project)"
		)
		.action(async options => {
			try {
				let apis = await createApis();

				// Execute with token refresh support
				await withTokenRefresh(
					async () => {
						// Resolve project
						const projectData = await resolveProject(
							apis.projectsApi,
							options
						);

						const spinner = ora(
							`Listing agents in project ${projectData.name}...`
						).start();

						try {
							// Get the agents for the specific project
							const agentsResponse: any =
								await apis.agentsApi.machineAgentControllerGetMachineAgentByProjectId(
									projectData.id,
									0,
									10,
									AgentType.REGULAR
								);

							spinner.succeed("Successfully retrieved agents");

							// Display the results
							const agents =
								agentsResponse.data?.machineAgents || [];

							if (!agents || agents.length === 0) {
								console.log(
									chalk.yellow(
										`No agents found in project ${projectData.name}`
									)
								);
								return;
							}

							console.log(
								chalk.blue(
									`\nAgents in project ${projectData.name}:\n`
								)
							);

							// Create a formatted table
							const table = new Table({
								head: [
									chalk.white.bold("ID"),
									chalk.white.bold("Name"),
									chalk.white.bold("URL"),
								],
								style: {
									head: [],
									border: [],
								},
							});

							// Add agents to the table
							agents.forEach((agent: any) => {
								let url = "N/A";
								if (agent.instanceIP) {
									url = `${agent.instanceIP}/v1/agents/${agent.modelBaseId}/query`;
								}

								table.push([
									agent.id || "N/A",
									agent.agentName || "N/A",
									url,
								]);
							});

							console.log(table.toString());
							console.log(`\nTotal agents: ${agents.length}`);
						} catch (error: any) {
							spinner.fail("Failed to retrieve agents");
							throw error;
						}
					},
					async () => {
						// Recreate APIs after token refresh
						apis = await createApis();
					}
				);
			} catch (error: any) {
				if (error.message && error.message.includes("Authentication")) {
					console.error(chalk.red(error.message));
				} else if (error.response?.data?.message) {
					console.error(
						chalk.red("API Error:"),
						error.response.data.message
					);
				} else {
					console.error(
						chalk.red("Error:"),
						error.message || "Unknown error"
					);
				}
			}
		});
}
