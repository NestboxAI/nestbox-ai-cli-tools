import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerCollectionUpdateCommand(
	collectionCommand: Command
): void {
	const updateCmd = collectionCommand
		.command("update")
		.description("Update a document collection for a specific instance")
		.requiredOption("--instance <instanceId>", "Instance ID")
		.requiredOption(
			"--collection <collectionId>",
			"ID of the document collection to update"
		)
		.option("--name <name>", "New name of the document collection")
		.option(
			"--metadata <json>",
			"New metadata for the document collection in JSON format"
		)
		.option(
			"--project <projectId>",
			"Project ID or name (defaults to the current project)"
		);

	updateCmd.action(async options => {
		await withTokenRefresh(async () => {
			const apis = await createDocumentApis();
			const project = await resolveProject(apis.projectsApi, options);

			const spinner = ora(
				`Updating document collection "${options.collection}" for instance ${options.instance} in project ${project.name}...`
			).start();

			try {
				const metadataObj = options.metadata
					? JSON.parse(options.metadata)
					: {};

				await apis.documentsApi.documentControllerUpdateCollection(
					project.id,
					options.instance,
					options.collection,
					{
						name: options.name,
						metadata: metadataObj,
					}
				);

				spinner.succeed("Successfully updated document collection");
				console.log(
					chalk.green(
						`Document collection "${options.collection}" updated successfully.`
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
