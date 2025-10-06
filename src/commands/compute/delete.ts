import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createComputeApis } from "./apiUtils";
import inquirer from "inquirer";
import axios from "axios";

export function registerDeleteCommand(computeCommand: Command): void {
  computeCommand
    .command('delete')
    .description('Delete one or more compute instances')
    .option('--project <projectId>', 'Project ID or name (defaults to the current project)')
    .option('--force', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const apis = await createComputeApis();
        if (!apis) {
          return;
        }

        const { machineInstanceApi, projectsApi, authData } = apis;

        // Resolve project using the shared utility
        const project = await resolveProject(projectsApi, options);
        
        const spinner = ora(`Fetching compute instances for project: ${project.name}`).start();
        
        try {
          // Fetch machine instances for the project
          const instancesResponse: any = await machineInstanceApi.machineInstancesControllerGetMachineInstanceByUserId(
            project.id,
            0, // page
            50 // limit - increased to show more instances
          );
          
          spinner.succeed('Successfully retrieved compute instances');
          
          const instances = instancesResponse.data?.machineInstances || [];
          
          if (instances.length === 0) {
            console.log(chalk.yellow('No compute instances found for this project.'));
            return;
          }
          
          // Create choices for the selection prompt
          const instanceChoices = instances.map((instance: any) => ({
            name: `${instance.instanceName || 'Unnamed'} (${instance.id})`,
            value: instance.id,
            short: instance.instanceName || instance.id
          }));
          
          // Prompt user to select instances to delete
          const { selectedInstances } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'selectedInstances',
              message: 'Select compute instances to delete:',
              choices: instanceChoices,
              validate: (input) => {
                if (input.length === 0) {
                  return 'Please select at least one instance to delete';
                }
                return true;
              }
            }
          ]);
          
          if (selectedInstances.length === 0) {
            console.log(chalk.yellow('No instances selected for deletion.'));
            return;
          }
          
          // Show selected instances
          console.log(chalk.yellow('\nSelected instances for deletion:'));
          const selectedInstanceDetails = instances
            .filter((instance: any) => selectedInstances.includes(instance.id))
            .map((instance: any) => `  - ${chalk.cyan(instance.instanceName || 'Unnamed')} (${instance.id})`);
            
          console.log(selectedInstanceDetails.join('\n'));
          
          // Confirm deletion if not using --force
          if (!options.force) {
            const { confirmDeletion } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirmDeletion',
                message: chalk.red('Are you sure you want to delete these instances? This cannot be undone.'),
                default: false
              }
            ]);
            
            if (!confirmDeletion) {
              console.log(chalk.yellow('Deletion cancelled.'));
              return;
            }
          }
          
          // Process deletion - using single request with all selected IDs
          const deleteSpinner = ora(`Deleting ${selectedInstances.length} instance(s)...`).start();
          
          try {
            await axios.delete(
              `${authData.apiURL}/projects/${project.id}/instances`,
              {
                data: { ids: selectedInstances },
                headers: {
                  Authorization: authData.token,
                }
              }
            );
            
            deleteSpinner.succeed(`Successfully deleted ${selectedInstances.length} instance(s)`);
            
            console.log(chalk.green('\nAll selected instances have been deleted'));
            console.log(chalk.gray('You can verify with: nestbox compute list'));
            
          } catch (error: any) {
            deleteSpinner.fail(`Failed to delete instances`);
            if (error.response && error.response.status === 401) {
              console.error(chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".'));
            } else if (error.response) {
              console.error(chalk.red('API Error:'), error.response.data?.message || 'Unknown error');
            } else {
              console.error(chalk.red('Error:'), error.message || 'Unknown error');
            }
          }
          
        } catch (error: any) {
          spinner.fail('Failed to retrieve compute instances');
          if (error.response && error.response.status === 401) {
            console.error(chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".'));
          } else if (error.response) {
            console.error(chalk.red('API Error:'), error.response.data?.message || 'Unknown error');
          } else {
            console.error(chalk.red('Error:'), error.message || 'Unknown error');
          }
        }
      } catch (error: any) {
        if (error.response && error.response.status === 401) {
          console.error(chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".'));
        } else {
          console.error(chalk.red('Error:'), error.message || 'Unknown error');
        }
      }
    });
}
