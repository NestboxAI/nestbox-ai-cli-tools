import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerDocUpdateCommand(docCommand: Command): void {
  const updateDocCmd = docCommand
    .command('update')
    .description('Update a document in a collection')
    .requiredOption('--instance <instanceId>', 'Instance ID')
    .requiredOption('--collection <collectionId>', 'Collection ID')
    .requiredOption('--doc <docId>', 'Document ID')
    .requiredOption('--document <string>', 'Updated document content as a string')
    .option('--metadata <json>', 'Updated document metadata in JSON format (optional)')
    .option('--project <projectId>', 'Project ID or name (defaults to the current project)');

  updateDocCmd.action(async (options) => {
    await withTokenRefresh(async () => {
      const apis = createDocumentApis();
      const project = await resolveProject(apis.projectsApi, options);
      
      const spinner = ora(`Updating document "${options.doc}" in collection "${options.collection}" in instance ${options.instance}...`).start();
      
      try {
        const documentContent = options.document;
        const metadata = options.metadata ? JSON.parse(options.metadata) : {};
        
        await apis.documentsApi.documentControllerUpdateDoc(
          project.id, 
          options.instance, 
          options.collection, 
          options.doc,
          {
            document: documentContent,
            metadata: metadata
          }
        );
        
        spinner.succeed('Successfully updated document');
        console.log(chalk.green(`Document with ID "${options.doc}" updated successfully in collection "${options.collection}".`));
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
