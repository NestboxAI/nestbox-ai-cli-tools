import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerDocDeleteCommand(docCommand: Command): void {
  const deleteDocCmd = docCommand
    .command('delete')
    .description('Delete a document from a collection')
    .requiredOption('--instance <instanceId>', 'Instance ID')
    .requiredOption('--collection <collectionId>', 'Collection ID')
    .requiredOption('--doc <docId>', 'Document ID')
    .option('--project <projectId>', 'Project ID or name (defaults to the current project)');

  deleteDocCmd.action(async (options) => {
    await withTokenRefresh(async () => {
      const apis = createDocumentApis();
      const project = await resolveProject(apis.projectsApi, options);
      
      const spinner = ora(`Deleting document "${options.doc}" from collection "${options.collection}" in instance ${options.instance}...`).start();
      
      try {
        await apis.documentsApi.documentControllerDeleteDocById(
          project.id, 
          options.instance, 
          options.collection, 
          options.doc
        );
        
        spinner.succeed('Successfully deleted document');
        console.log(chalk.green(`Document with ID "${options.doc}" deleted successfully from collection "${options.collection}".`));
      } catch (error: any) {
        spinner.fail('Operation failed');
        if (error.response && error.response.status === 401) {
          console.error(chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".'));
        } else if (error.response?.data?.message) {
          console.error(chalk.red('API Error:'), error.response.data.message);
        } else {
          console.error(chalk.red('Error:'), error.message || 'Unknown error');
        }
        throw error;
      }
    });
  });
}
