import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerCollectionDeleteCommand(
	collectionCommand: Command
): void {
	const deleteCmd = collectionCommand
		.command("delete")
		.description("Delete a document collection for a specific instance")
		.requiredOption("--instance <instanceId>", "Instance ID")
		.requiredOption(
			"--collection <collectionId>",
			"ID of the document collection to delete"
		)
		.option(
			"--project <projectId>",
			"Project ID or name (defaults to the current project)"
		);

	deleteCmd.action(async options => {
		await withTokenRefresh(async () => {
			const apis = await createDocumentApis();
			const project = await resolveProject(apis.projectsApi, options);

			const spinner = ora(
				`Deleting document collection "${options.collection}" for instance ${options.instance} in project ${project.name}...`
			).start();

			try {
				await apis.documentsApi.documentControllerDeleteCollection(
					project.id,
					options.instance,
					options.collection
				);

				spinner.succeed("Successfully deleted document collection");
				console.log(
					chalk.green(
						`Document collection "${options.collection}" deleted successfully.`
					)
				);
			} catch (error: any) {
				spinner.fail("Operation failed");
				if (error.response && error.response.status === 401) {
					console.error(
						chalk.red(
							'Authentication token has expired. Please login again using "nestbox login <domain>".'
						)
					);
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
				throw error;
			}
		});
	});
}
