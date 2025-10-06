import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerDocAddCommand(docCommand: Command): void {
	const addDocCmd = docCommand
		.command("add")
		.description("Add a new document to a collection")
		.requiredOption("--instance <instanceId>", "Instance ID")
		.requiredOption("--collection <collectionId>", "Collection ID")
		.requiredOption("--id <id>", "Document ID")
		.requiredOption("--document <json>", "Document content in JSON format")
		.option(
			"--metadata <json>",
			"Document metadata in JSON format (optional)"
		)
		.option(
			"--project <projectId>",
			"Project ID or name (defaults to the current project)"
		);

	addDocCmd.action(async options => {
		await withTokenRefresh(async () => {
			const apis = await createDocumentApis();
			const project = await resolveProject(apis.projectsApi, options);

			const spinner = ora(
				`Adding document to collection "${options.collection}" in instance ${options.instance}...`
			).start();

			try {
				const documentContent = JSON.parse(options.document);
				const metadata = options.metadata
					? JSON.parse(options.metadata)
					: {};

				await apis.documentsApi.documentControllerAddDocToCollection(
					project.id,
					options.instance,
					options.collection,
					{
						id: options.id,
						document: JSON.stringify(documentContent),
						metadata: metadata,
					}
				);

				spinner.succeed("Successfully added document to collection");
				console.log(
					chalk.green(
						`Document with ID "${options.id}" added successfully to collection "${options.collection}".`
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
