import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerDocSearchCommand(docCommand: Command): void {
	const searchCmd = docCommand
		.command("search")
		.description("Search for documents in a collection")
		.requiredOption("--instance <instanceId>", "Instance ID")
		.requiredOption("--collection <collectionId>", "Collection ID")
		.requiredOption("--query <query>", "Search query")
		.option(
			"--project <projectId>",
			"Project ID or name (defaults to the current project)"
		)
		.option("--filter <json>", "Filter criteria as JSON string");

	searchCmd.action(async options => {
		await withTokenRefresh(async () => {
			const apis = await createDocumentApis();
			const project = await resolveProject(apis.projectsApi, options);

			// Build the request body
			const requestBody = {
				query: options.query,
				params: {},
				filter: {},
				include: ["embedding"],
			};

			// Parse filter JSON if provided
			if (options.filter) {
				try {
					requestBody.filter = JSON.parse(options.filter);
				} catch (e: any) {
					console.error(
						chalk.red("Error parsing filter JSON:"),
						e.message
					);
					return;
				}
			}

			console.log("REQUEST BODY", requestBody);

			const spinner = ora(
				`Searching for documents in collection "${options.collection}" in instance ${options.instance}...`
			).start();

			try {
				const response =
					await apis.documentsApi.documentControllerSimilaritySearch(
						project.id,
						options.instance,
						options.collection,
						requestBody
					);
				const results = response.data;

				spinner.succeed("Successfully retrieved search results");
				console.log(
					chalk.blue(
						`\nSearch results for query "${options.query}" in collection "${options.collection}":\n`
					)
				);
				console.log(JSON.stringify(results, null, 2));
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
