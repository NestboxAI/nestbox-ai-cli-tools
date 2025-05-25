import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getAuthToken } from "../utils/auth";
import { Configuration, ProjectsApi, MachineInstancesApi, MiscellaneousApi } from "@nestbox-ai/admin";
import { resolveProject } from "../utils/project";
import inquirer from "inquirer";
import axios from "axios";
import { userData } from "../utils/user";

export function registerComputeProgram(program: Command): void {
    const authToken = getAuthToken();
    
    if (!authToken) {
        console.error(chalk.red('No authentication token found. Please login first.'));
        return;
    }
    
    const configuration = new Configuration({
        basePath: authToken.serverUrl,
        baseOptions: {
            headers: {
                "Authorization": authToken.token,
            }
        }
    });

    const machineInstanceApi = new MachineInstancesApi(configuration);
    const miscellaneousApi = new MiscellaneousApi(configuration);
    const projectsApi = new ProjectsApi(configuration);

    // Create the main compute command
    const computeCommand = program
        .command('compute')
        .description('Manage Nestbox computes');

    // List command
    computeCommand
        .command('list')
        .description('List all compute instances')
        .option('--project <projectId>', 'Project ID or name (defaults to the current project)')
        .action(async (options) => {
            try {
                // Resolve project using the shared utility
                const project = await resolveProject(projectsApi, options);
                
                const spinner = ora(`Fetching compute instances for project: ${project.name}`).start();
                
                try {
                    // Fetch machine instances for the project
                    const instancesResponse: any = await machineInstanceApi.machineInstancesControllerGetMachineInstanceByUserId(
                        project.id,
                        0, // page
                        10 // limit
                    );
                    
                    spinner.succeed('Successfully retrieved compute instances');
                    
                    const instances = instancesResponse.data?.machineInstances || [];
                    
                    if (instances.length === 0) {
                        console.log(chalk.yellow('No compute instances found for this project.'));
                        return;
                    }
                    
                    // Create table for display
                    const table = new Table({
                        head: [
                            chalk.white.bold('ID'), 
                            chalk.white.bold('Name'), 
                            chalk.white.bold('Status'), 
                            chalk.white.bold('API Key')
                        ],
                        style: {
                            head: [], // Disable the default styling
                            border: []
                        }
                    });
                    
                    // Status mappings
                    const statusMappings: any = {
                        'Job Scheduled': 'Scheduled',
                        'Job Executed': 'Ready',
                        'Job in Progress': 'Initializing',
                        'Job Failed': 'Failed',
                        'Deleting': 'Deleting',
                    };
                    
                    // Add rows to the table
                    instances.forEach((instance: any) => {
                        // Map the status if a mapping exists
                        const originalStatus = instance.runningStatus || 'unknown';
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
                            instance.id || 'N/A',
                            instance.instanceName || 'N/A',
                            statusColor,
                            instance.instanceApiKey || 'N/A'
                        ]);
                    });
                    
                    // Display the table
                    console.log(table.toString());
                    
                } catch (error: any) {
                    spinner.fail('Failed to retrieve compute instances');
                    if (error.response) {
                        console.error(chalk.red('API Error:'), error.response.data?.message || 'Unknown error');
                    } else {
                        console.error(chalk.red('Error:'), error.message || 'Unknown error');
                    }
                }
            } catch (error: any) {
                console.error(chalk.red('Error:'), error.message || 'Unknown error');
            }
        });


        computeCommand
        .command('create')
        .description('Create a new compute instance')
        .requiredOption('--image <imageId>', 'Image ID to use for the compute instance')
        .option('--project <projectId>', 'Project ID or name (defaults to the current project)')
        .action(async (options) => {
          try {
            // Resolve project using the shared utility
            const project = await resolveProject(projectsApi, options);
            
            const spinner = ora(`Fetching available images...`).start();
            
            try {
              // Get available images data
              const response = await miscellaneousApi.miscellaneousControllerGetData();
              const availableImages: any = response.data || [];
      
              // Find the selected image
              const selectedImage = availableImages.find((image: any) => image.id === options.image);
              
              if (!selectedImage) {
                spinner.fail(`Image ID '${options.image}' does not exist.`);
                console.log(chalk.yellow('Available image IDs:'));
                availableImages.forEach((img: any) => {
                  console.log(`  ${chalk.cyan(img.id)} - ${img.name} (${img.type})`);
                });
                return;
              }
      
              spinner.succeed(`Found image: ${selectedImage.name}`);
              
              // Ask for instance name first
              const instanceNameAnswer = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'instanceName',
                  message: 'Enter a name for this compute instance:',
                  validate: (input: string) => {
                    if (!input || input.trim() === '') {
                      return 'Instance name cannot be empty';
                    }
                    // Add more validation here if needed (e.g., checking for valid characters)
                    return true;
                  }
                }
              ]);
              
              const instanceName = instanceNameAnswer.instanceName;
              
              // Directly create the provisioningParams object with the structure needed for API
              let provisioningParams: Record<string, any> = {};
              
              if (selectedImage.provisioningParameters && 
                  selectedImage.provisioningParameters.properties) {
                
                const requiredParams = selectedImage.provisioningParameters.required || [];
                const paramProperties = selectedImage.provisioningParameters.properties;
                
                // Build questions for inquirer
                const questions = [];
                
                for (const [paramName, paramConfig] of Object.entries(paramProperties) as any) {
                  const isRequired = requiredParams.includes(paramName);
                  const paramUI = selectedImage.provisioningParametersUI?.[paramName] || {};
                  
                  let question: any = {
                    name: paramName,
                    message: paramUI['ui:title'] || `Enter ${paramName}:`,
                    when: isRequired // Only ask required params by default
                  };
                  
                  // Handle different parameter types
                  if (paramConfig.type === 'string') {
                    if (paramConfig.enum) {
                      question.type = 'list';
                      question.choices = paramConfig.enum;
                    } else if (paramUI['ui:widget'] === 'password') {
                      question.type = 'password';
                    } else {
                      question.type = 'input';
                    }
                  } else if (paramConfig.type === 'array') {
                    if (paramConfig.items && paramConfig.items.enum) {
                      question.type = 'checkbox';
                      question.choices = paramConfig.items.enum;
                      // Ensure at least one option is selected for required array parameters
                      question.validate = (input: any[]) => {
                        if (isRequired && (!input || input.length === 0)) {
                          return 'Please select at least one option';
                        }
                        return true;
                      };
                    }
                  }
                  
                  if (paramUI['ui:help']) {
                    question.message += ` (${paramUI['ui:help']})`;
                  }
                  
                  questions.push(question);
                }
                
                if (questions.length > 0) {
                  console.log(chalk.blue(`\nPlease provide the required parameters for ${selectedImage.name}:`));
                  const answers = await inquirer.prompt(questions);
                  
                  // Assign the answers directly to provisioningParams
                  for (const [key, value] of Object.entries(answers)) {
                    provisioningParams[key] = value;
                  }
                }
              }
              
              // Now we have all the required params in provisioningParams
              console.log(chalk.green(`\nCreating compute instance '${instanceName}' with image '${selectedImage.name}'`));
              console.log(chalk.dim('Using the following parameters:'));
              
              for (const [key, value] of Object.entries(provisioningParams)) {
                console.log(chalk.dim(`  ${key}: ${Array.isArray(value) ? value.join(', ') : value}`));
              }
              
              // Start a spinner for the creation process
              const creationSpinner = ora('Creating compute instance...').start();

              const getUserData = await userData();

              try {
                const createParams = {
                  userId: getUserData.id,
                  machineId: selectedImage.id,
                  machineTitle: selectedImage.name,
                  instanceName: instanceName,
                  ...provisioningParams
                };
      
                    const createResponse = await axios.post(
                        `${authToken.serverUrl}/projects/${project.id}/instances`,
                        createParams,
                        {
                            headers: {
                            Authorization: authToken.token,
                            },
                        }
                        );
                    creationSpinner.succeed('Compute instance created successfully!');
                
                
                console.log(chalk.green(`\nInstance '${instanceName}' is now being provisioned`));
                console.log(chalk.gray('You can check the status with: nestbox compute list'));
                console.log(chalk.green("Instance created successfully!"));
              } catch (createError: any) {
                creationSpinner.fail('Failed to create compute instance');
                if (createError.response) {
                  console.error(chalk.red('API Error:'), createError.response.data?.message || 'Unknown error');
                } else {
                  console.error(chalk.red('Error:'), createError.message || 'Unknown error');
                }
              }
              
            } catch (error: any) {
              spinner.fail('Failed to fetch available images');
              if (error.response) {
                console.error(chalk.red('API Error:'), error.response.data?.message || 'Unknown error');
              } else {
                console.error(chalk.red('Error:'), error.message || 'Unknown error');
              }
            }
          } catch (error: any) {
            console.error(chalk.red('Error:'), error.message || 'Unknown error');
          }
        });


        computeCommand
        .command('delete')
        .description('Delete one or more compute instances')
        .option('--project <projectId>', 'Project ID or name (defaults to the current project)')
        .option('--force', 'Skip confirmation prompt')
        .action(async (options) => {
          try {
            // Resolve project using the shared utility
            const project = await resolveProject(projectsApi, options);
            
            const spinner = ora(`Fetching compute instances for project: ${project.name}`).start();
            
            try {
              // Fetch machine instances for the project
              const instancesResponse: any= await machineInstanceApi.machineInstancesControllerGetMachineInstanceByUserId(
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
                  `${authToken.serverUrl}/projects/${project.id}/instances`,
                  {
                    data: { ids: selectedInstances },
                    headers: {
                      Authorization: authToken.token,
                    }
                  }
                );
                
                deleteSpinner.succeed(`Successfully deleted ${selectedInstances.length} instance(s)`);
                
                console.log(chalk.green('\nAll selected instances have been deleted'));
                console.log(chalk.gray('You can verify with: nestbox compute list'));
                
              } catch (error: any) {
                deleteSpinner.fail(`Failed to delete instances`);
                if (error.response) {
                  console.error(chalk.red('API Error:'), error.response.data?.message || 'Unknown error');
                } else {
                  console.error(chalk.red('Error:'), error.message || 'Unknown error');
                }
              }
              
            } catch (error: any) {
              spinner.fail('Failed to retrieve compute instances');
              if (error.response) {
                console.error(chalk.red('API Error:'), error.response.data?.message || 'Unknown error');
              } else {
                console.error(chalk.red('Error:'), error.message || 'Unknown error');
              }
            }
          } catch (error: any) {
            console.error(chalk.red('Error:'), error.message || 'Unknown error');
          }
        });
}