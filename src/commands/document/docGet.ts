import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerDocGetCommand(docCommand: Command): void {
	const getDocCmd = docCommand
		.command("get")
		.description("Get a document from a collection")
		.requiredOption("--instance <instanceId>", "Instance ID")
		.requiredOption("--collection <collectionId>", "Collection ID")
		.requiredOption("--doc <docId>", "Document ID")
		.option(
			"--project <projectId>",
			"Project ID or name (defaults to the current project)"
		);

	getDocCmd.action(async options => {
		await withTokenRefresh(async () => {
			const apis = await createDocumentApis();
			const project = await resolveProject(apis.projectsApi, options);

			const spinner = ora(
				`Getting document "${options.doc}" from collection "${options.collection}" in instance ${options.instance}...`
			).start();

			try {
				const response =
					await apis.documentsApi.documentControllerGetDocById(
						project.id,
						options.instance,
						options.collection,
						options.doc
					);
				const document = response.data;

				spinner.succeed("Successfully retrieved document");
				console.log(
					chalk.blue(
						`\nDocument details for ID "${options.doc}" in collection "${options.collection}":\n`
					)
				);
				console.log(JSON.stringify(document, null, 2));
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
