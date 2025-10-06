import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createApis } from "./apiUtils";
import { displayImagesTable } from "./display";

export function registerListCommand(imageCommand: Command): void {
	imageCommand
		.command("list")
		.description("List images for a project")
		.option(
			"--project <projectId>",
			"Project ID or name (defaults to the current project)"
		)
		.action(async options => {
			try {
				const apis = await createApis();

				// Execute with token refresh support
				await withTokenRefresh(async () => {
					// Resolve project using the shared utility
					const project = await resolveProject(
						apis.projectsApi,
						options
					);

					const spinner = ora(
						`Listing images for project ${project.name}...`
					).start();

					try {
						const response =
							await apis.miscellaneousApi.miscellaneousControllerGetData();

						spinner.succeed("Successfully retrieved images");

						const images: any = response.data;

						if (!images || images.length === 0) {
							console.log(
								chalk.yellow(
									`No images found for project ${project.name}.`
								)
							);
							return;
						}

						// Create and display the table
						displayImagesTable(images);
					} catch (error: any) {
						spinner.fail("Failed to retrieve images");
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
				});
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
