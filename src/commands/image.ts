import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { getAuthToken } from '../utils/auth';
import { Configuration, MiscellaneousApi, ProjectsApi } from '@nestbox-ai/admin';
import { resolveProject } from '../utils/project';
import { withTokenRefresh } from '../utils/error';

export function registerImageCommands(program: Command): void {
  // Function to create/recreate API instances
  const createApis = () => {
    const authToken = getAuthToken();
    if (!authToken) {
      throw new Error('No authentication token found. Please log in first.');
    }
    
    const configuration = new Configuration({
      basePath: authToken.serverUrl,
      baseOptions: {
        headers: {
          Authorization: authToken.token,
        },
      },
    });

    return {
      miscellaneousApi: new MiscellaneousApi(configuration),
      projectsApi: new ProjectsApi(configuration)
    };
  };

  const imageCommand = program.command('image').description('Manage Nestbox images');

  // LIST command
  imageCommand
    .command('list')
    .description('List images for a project')
    .option('--project <projectId>', 'Project ID or name (defaults to the current project)')
    .action(async (options) => {
      const spinner = ora('Processing...').start();
      
      try {
        let apis = createApis();
        
        // Execute all operations with token refresh support
        const result = await withTokenRefresh(
          async () => {
            // Resolve project without showing its own spinner
            spinner.text = 'Resolving project...';
            const project = await resolveProject(apis.projectsApi, { 
              ...options, 
              showSpinner: false  // Disable resolveProject's spinner
            });
            
            // Fetch images
            spinner.text = `Listing images for project ${project.name}...`;
            const response = await apis.miscellaneousApi.miscellaneousControllerGetData();
            
            return { project, images: response.data };
          },
          () => {
            // Recreate APIs after token refresh
            apis = createApis();
          }
        );

        spinner.succeed('Successfully retrieved images');

        const project: any = result.project;
        const images: any = result.images;

        if (!images || images.length === 0) {
          console.log(chalk.yellow(`No images found for project ${project.name}.`));
          return;
        }

        // Create and display the table
        displayImagesTable(images);

      } catch (error: any) {
        spinner.fail('Operation failed');
        handleError(error);
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

// Helper function to handle errors
function handleError(error: any): void {
  if (error.message) {
    if (error.message.includes('Authentication')) {
      console.error(chalk.red(error.message));
    } else if (error.message.includes('No project')) {
      // Project-related errors are already well-formatted
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red('Error:'), error.message);
    }
  } else if (error.response?.data?.message) {
    console.error(chalk.red('API Error:'), error.response.data.message);
  } else {
    console.error(chalk.red('Error:'), 'Unknown error occurred');
  }
}