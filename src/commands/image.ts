import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { MiscellaneousApi, ProjectsApi } from '@nestbox-ai/admin';
import { resolveProject } from '../utils/project';
import { setupAuthAndConfig } from '../utils/api';

export function registerImageCommands(program: Command): void {
  const authResult = setupAuthAndConfig();
  
  if (!authResult) {
    return;
  }

  const { configuration } = authResult;
  const miscellaneousApi = new MiscellaneousApi(configuration);
  const projectsApi = new ProjectsApi(configuration);

  const imageCommand = program.command('image').description('Manage Nestbox images');

  // LIST command
  imageCommand
    .command('list')
    .description('List images for a project')
    .option('--project <projectId>', 'Project ID or name (defaults to the current project)')
    .action(async (options) => {
      try {
        // Resolve project using the shared utility
        const project = await resolveProject(projectsApi, options);
        
        const spinner = ora(`Listing images for project ${project.name}...`).start();
        
        try {
          const response = await miscellaneousApi.miscellaneousControllerGetData();
          
          spinner.succeed('Successfully retrieved images');

          const images: any = response.data;

          if (!images || images.length === 0) {
            console.log(chalk.yellow(`No images found for project ${project.name}.`));
            return;
          }

          // Create and display the table
          displayImagesTable(images);

        } catch (error: any) {
          spinner.fail('Failed to retrieve images');
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

  // Additional commands can be added here following the same pattern
}

// Helper function to display images in a table
function displayImagesTable(images: any[]): void {
  const table = new Table({
    head: [
      chalk.white.bold('Name'), 
      chalk.white.bold('Type'),
      chalk.white.bold('License'), 
      chalk.white.bold('Category'),
      chalk.white.bold('Pricing'),
      chalk.white.bold('Source')
    ],
    style: {
      head: [],
      border: []
    }
  });
  
  // Status mappings (kept from original code for potential future use)
  const statusMappings: Record<string, string> = {
    'Job Scheduled': 'Scheduled',
    'Job Executed': 'Ready',
    'Job in Progress': 'Initializing',
    'Job Failed': 'Failed',
    'Deleting': 'Deleting',
  };
  
  // Add rows to the table
  images.forEach((image: any) => {
    table.push([
      image.name || 'N/A',
      image.type || 'N/A',
      image.metadata?.License || 'N/A',
      image.metadata?.Type || 'N/A',
      image.metadata?.Pricing || 'N/A',
      image.source || 'N/A'
    ]);
  });
  
  console.log(table.toString());
}