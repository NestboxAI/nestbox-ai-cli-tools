import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { resolveProject } from "../../utils/project";
import { createComputeApis } from "./apiUtils";
import { statusMappings } from "../../types/statusMapping";

export function registerListCommand(computeCommand: Command): void {
	computeCommand
		.command("list")
		.description("List all compute instances")
		.option(
			"--project <projectId>",
			"Project ID or name (defaults to the current project)"
		)
		.action(async options => {
			try {
				const apis = await createComputeApis();
				if (!apis) {
					return;
				}

				const { machineInstanceApi, projectsApi } = apis;

				// Resolve project using the shared utility
				const project = await resolveProject(projectsApi, options);

				const spinner = ora(
					`Fetching compute instances for project: ${project.name}`
				).start();

				try {
					// Fetch machine instances for the project
					const instancesResponse: any =
						await machineInstanceApi.machineInstancesControllerGetMachineInstanceByUserId(
							project.id,
							0, // page
							10 // limit
						);

					spinner.succeed("Successfully retrieved compute instances");

					const instances =
						instancesResponse.data?.machineInstances || [];

					if (instances.length === 0) {
						console.log(
							chalk.yellow(
								"No compute instances found for this project."
							)
						);
						return;
					}

					// Create table for display
					const table = new Table({
						head: [
							chalk.white.bold("ID"),
							chalk.white.bold("Name"),
							chalk.white.bold("Status"),
							chalk.white.bold("API Key"),
						],
						style: {
							head: [], // Disable the default styling
							border: [],
						},
					});

					// Add rows to the table
					instances.forEach((instance: any) => {
						// Map the status if a mapping exists
						const originalStatus =
							instance.runningStatus || "unknown";
						const displayStatus =
							statusMappings[originalStatus] || originalStatus;

						// Color the status based on its mapped value
						let statusColor;

						switch (displayStatus.toLowerCase()) {
							case "ready":
								statusColor = chalk.green(displayStatus);
								break;
							case "failed":
								statusColor = chalk.red(displayStatus);
								break;
							case "initializing":
								statusColor = chalk.yellow(displayStatus);
								break;
							case "scheduled":
								statusColor = chalk.blue(displayStatus);
								break;
							case "deleting":
								statusColor = chalk.red(displayStatus);
								break;
							default:
								statusColor = chalk.gray(displayStatus);
						}

						table.push([
							instance.id || "N/A",
							instance.instanceName || "N/A",
							statusColor,
							instance.instanceApiKey || "N/A",
						]);
					});

					// Display the table
					console.log(table.toString());
				} catch (error: any) {
					spinner.fail("Failed to retrieve compute instances");
					if (error.response && error.response.status === 401) {
						console.error(
							chalk.red(
								'Authentication token has expired. Please login again using "nestbox login <domain>".'
							)
						);
					} else if (error.response) {
						console.error(
							chalk.red("API Error:"),
							error.response.data?.message || "Unknown error"
						);
					} else {
						console.error(
							chalk.red("Error:"),
							error.message || "Unknown error"
						);
					}
				}
			} catch (error: any) {
				if (error.response && error.response.status === 401) {
					console.error(
						chalk.red(
							'Authentication token has expired. Please login again using "nestbox login <domain>".'
						)
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
