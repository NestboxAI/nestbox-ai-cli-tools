import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { getAuthToken } from '../utils/auth';
import { Configuration, MiscellaneousApi, ProjectsApi } from '@nestbox-ai/admin';
import { resolveProject } from '../utils/project';

/**
 * Executes an async command with proper error handling and spinner feedback
 */
async function executeCommand<T>(
  description: string, 
  command: () => Promise<T>, 
  successMessage: string
): Promise<T> {
  const spinner = ora(description).start();
  
  try {
    const result = await command();
    spinner.succeed(successMessage);
    return result;
  } catch (error: any) {
    spinner.fail('Operation failed');

    if (error.response?.data?.message) {
      console.error(chalk.red('API Error:'), error.response.data.message);
    } else {
      console.error(chalk.red('Error:'), error.message || 'Unknown error');
    }
    
    throw error;
  }
}

export function registerImageCommands(program: Command): void {
  const authToken = getAuthToken();

  if (!authToken) {
    console.error(chalk.red('No authentication token found. Please login first.'));
    return;
  }

  const configuration = new Configuration({
    basePath: authToken.serverUrl,
    baseOptions: {
      headers: {
        Authorization: authToken.token,
      },
    },
  });

  const miscellaneousApi = new MiscellaneousApi(configuration);
  const projectsApi = new ProjectsApi(configuration);

  const imageCommand = program.command('image').description('Manage Nestbox images');

  // LIST command
  const listCmd = imageCommand
    .command('list')
    .description('List images for a project')
    .option('--project <projectId>', 'Project ID or name (defaults to the current project)');
  
  listCmd.action(async (options) => {
    try {
      const project = await resolveProject(projectsApi, options);
      
      const images: any = await executeCommand(
        `Listing images for project ${project.name}...`,
        async () => {
          const response = await miscellaneousApi.miscellaneousControllerGetMachineInstanceByImageId(project.id);
          return response.data;
        },
        'Successfully retrieved images'
      );

      if (!images || images.length === 0) {
        console.log(chalk.yellow('No images found for this project.'));
        return;
      }

      // Create a table for displaying the image data
      const table = new Table({
        head: [
          chalk.white.bold('ID'), 
          chalk.white.bold('Name'), 
          chalk.white.bold('Machine Type'),
          chalk.white.bold('Status'), 
          chalk.white.bold('Region'),
          chalk.white.bold('API Key'),
          chalk.white.bold('Internal IP')
        ],
        style: {
          head: [], // Disable the default styling
          border: []
        }
      });
      
      // Status mappings
      const statusMappings: Record<string, string> = {
        'Job Scheduled': 'Scheduled',
        'Job Executed': 'Ready',
        'Job in Progress': 'Initializing',
        'Job Failed': 'Failed',
        'Deleting': 'Deleting',
      };
      
      // Add rows to the table
      images.forEach((image: any) => {
        // Map the status if a mapping exists
        const originalStatus = image.runningStatus || 'unknown';
        const displayStatus = statusMappings[originalStatus] || originalStatus;
        
        // Color the status based on its mapped value
        let statusColor;
        
        switch(displayStatus.toLowerCase()) {
          case 'ready':
            statusColor = chalk.green(displayStatus);
            break;
          case 'failed':
            statusColor = chalk.red(displayStatus);
            break;
          case 'initializing':
            statusColor = chalk.yellow(displayStatus);
            break;
          case 'scheduled':
            statusColor = chalk.blue(displayStatus);
            break;
          case 'deleting':
            statusColor = chalk.red(displayStatus);
            break;
          default:
            statusColor = chalk.gray(displayStatus);
        }
        
        table.push([
          image.id || 'N/A',
          image.instanceName || 'N/A',
          image.machineTitle || 'N/A',
          statusColor,
          image.region || 'N/A',
          image.instanceApiKey || 'N/A',
          image.internalIP || 'N/A'
        ]);
      });
      
      // Display the table
      console.log(table.toString());

    } catch (error) {
      // Error already handled by executeCommand
    }
  });
}