import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import { readNestboxConfig } from "../../utils/config";
import { createApis } from "./apiUtils";

export function registerListCommand(projectCommand: Command): void {
	projectCommand
		.command("list")
		.description("List all projects")
		.action(async () => {
			try {
				const apis = await createApis();

				// Execute with token refresh support
				await withTokenRefresh(async () => {
					// Get projects from API
					const response =
						await apis.projectsApi.projectControllerGetAllProjects();
					const apiProjects = response.data.data.projects;

					if (!apiProjects || apiProjects.length === 0) {
						console.log(chalk.yellow("No projects found."));
						return;
					}

					// Read local config to get default project and aliases
					const config = readNestboxConfig();
					const localProjects = config.projects || {};
					const defaultProject = localProjects.default;

					console.log(chalk.blue("Available Projects:"));
					console.log(""); // Empty line for better formatting

					// Display each project from the API
					apiProjects.forEach((project: any) => {
						const projectName = project.name;
						const isDefault = defaultProject === projectName;

						// Find aliases for this project
						const aliases = Object.entries(localProjects)
							.filter(
								([key, value]) =>
									value === projectName &&
									key !== "default" &&
									key !== projectName
							)
							.map(([alias]) => alias);

						// Build the display line
						let displayLine = `  ${projectName}`;

						if (aliases.length > 0) {
							displayLine += chalk.gray(
								` (aliases: ${aliases.join(", ")})`
							);
						}

						if (isDefault) {
							displayLine += chalk.green(" [DEFAULT]");
						}

						console.log(displayLine);
					});

					// Show summary
					console.log(""); // Empty line
					if (defaultProject) {
						console.log(
							chalk.gray(`Default project: ${defaultProject}`)
						);
					} else {
						console.log(
							chalk.gray(
								'No default project set. Use "nestbox project use <project-name>" to set one.'
							)
						);
					}
				});
			} catch (error: any) {
				if (error.message && error.message.includes("Authentication")) {
					console.error(chalk.red(error.message));
				} else if (error.message) {
					console.error(
						chalk.red("Error listing projects:"),
						error.message
					);
				} else {
					console.error(
						chalk.red("Error listing projects:"),
						"Unknown error"
					);
				}
			}
		});
}
