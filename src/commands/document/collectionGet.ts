import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerCollectionGetCommand(collectionCommand: Command): void {
  const getCmd = collectionCommand
    .command('get')
    .description('Get details of a specific document collection for a specific instance')
    .requiredOption('--instance <instanceId>', 'Instance ID')
    .requiredOption('--collection <collectionId>', 'ID of the document collection to get')
    .option('--project <projectId>', 'Project ID or name (defaults to the current project)');
  
  getCmd.action(async (options) => {
    await withTokenRefresh(async () => {
      const apis = createDocumentApis();
      const project = await resolveProject(apis.projectsApi, options);
      
      const spinner = ora(`Getting document collection "${options.collection}" for instance ${options.instance} in project ${project.name}...`).start();
      
      try {
        const response = await apis.documentsApi.documentControllerGetCollectionInfo(
          project.id, 
          options.instance, 
          options.collection
        );
        const collectionDetails = response.data;
        
        spinner.succeed('Successfully retrieved document collection');
        console.log(chalk.blue(`\nDocument collection details for instance ${options.instance} in project ${project.name}:\n`));
        console.log(JSON.stringify(collectionDetails, null, 2));
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
