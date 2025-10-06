import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import { readNestboxConfig, writeNestboxConfig } from "../../utils/config";
import { createApis } from "./apiUtils";

export function registerUseCommand(projectCommand: Command): void {
	projectCommand
		.command("use <project-name>")
		.description("Set default project for all commands")
		.action(async (projectName: string) => {
			try {
				const apis = await createApis();

				// Execute with token refresh support
				await withTokenRefresh(async () => {
					const config = readNestboxConfig();
					config.projects = config.projects || {};
					config.projects.default = projectName;

					// Check if the project exists
					const response =
						await apis.projectsApi.projectControllerGetAllProjects();
					const projectExists = response.data.data.projects.some(
						(project: any) => project.name === projectName
					);
					if (!projectExists) {
						console.error(
							chalk.red(
								`Project '${projectName}' does not exist.`
							)
						);
						return;
					}

					// Write the configuration
					writeNestboxConfig(config);
					console.log(
						chalk.green(`Default project set to '${projectName}'`)
					);
				});
			} catch (error: any) {
				if (error.message && error.message.includes("Authentication")) {
					console.error(chalk.red(error.message));
				} else if (error.message) {
					console.error(
						chalk.red("Error setting default project:"),
						error.message
					);
				} else {
					console.error(
						chalk.red("Error setting default project:"),
						"Unknown error"
					);
				}
			}
		});
}
