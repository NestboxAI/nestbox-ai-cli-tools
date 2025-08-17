import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createDocumentApis } from "./apiUtils";

export function registerCollectionListCommand(collectionCommand: Command): void {
  const listCmd = collectionCommand
    .command('list')
    .description('List document collections for a specific instance')
    .requiredOption('--instance <instanceId>', 'Instance ID')
    .option('--project <projectId>', 'Project ID or name (defaults to the current project)');
  
  listCmd.action(async (options) => {
    await withTokenRefresh(async () => {
      const apis = createDocumentApis();
      const project = await resolveProject(apis.projectsApi, options);
      
      const spinner = ora(`Listing document collections for instance ${options.instance} in project ${project.name}...`).start();
      
      try {
        const response: any = await apis.documentsApi.documentControllerGetAllCollections(project.id, options.instance);
        const collections = Array.isArray(response.data?.collections) ? response.data.collections : [];
        
        spinner.succeed('Successfully retrieved document collections');

        if (collections.length === 0) {
          console.log(chalk.yellow(`No document collections found for instance ${options.instance} in project ${project.name}`));
          return;
        }

        console.log(chalk.blue(`\nDocument collections for instance ${options.instance} in project ${project.name}:\n`));

        collections.forEach((collection: any) => {
          const name = typeof collection === 'string' ? collection : collection?.name || 'Unnamed Collection';
          console.log(chalk.white.bold(name));
        });
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
