import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerDocUploadFileCommand(docCommand: Command): void {
	const uploadFileCmd = docCommand
		.command("upload-file")
		.description("Add documents by file chunking")
		.requiredOption("--instance <instanceId>", "Instance ID")
		.requiredOption("--collection <collectionId>", "Collection ID")
		.requiredOption("--file <path>", "Path to the file to upload")
		.option("--type <fileType>", "Type of the file (e.g., pdf, txt, doc)")
		.option(
			"--options <json>",
			"Additional options for file processing in JSON format"
		)
		.option(
			"--project <projectId>",
			"Project ID or name (defaults to the current project)"
		);

	uploadFileCmd.action(async options => {
		await withTokenRefresh(async () => {
			const apis = await createDocumentApis();
			const project = await resolveProject(apis.projectsApi, options);

			const spinner = ora(
				`Processing file "${options.file}" for collection "${options.collection}" in instance ${options.instance}...`
			).start();

			try {
				const requestData = {
					type: options.type,
					url: options.file,
					options: options.options ? JSON.parse(options.options) : {},
				};

				await apis.documentsApi.documentControllerAddDocToCollectionFromFile(
					project.id,
					options.instance,
					options.collection,
					requestData
				);

				spinner.succeed(
					"Successfully processed file for document chunking"
				);
				console.log(
					chalk.green(
						`File "${options.file}" processed successfully for collection "${options.collection}".`
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
