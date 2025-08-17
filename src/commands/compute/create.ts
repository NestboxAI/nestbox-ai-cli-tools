import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { createComputeApis } from "./apiUtils";
import inquirer from "inquirer";
import axios from "axios";
import { userData } from "../../utils/user";

export function registerCreateCommand(computeCommand: Command): void {
  computeCommand
    .command('create')
    .description('Create a new compute instance')
    .requiredOption('--image <imageId>', 'Image ID to use for the compute instance')
    .option('--project <projectId>', 'Project ID or name (defaults to the current project)')
    .action(async (options) => {
      try {
        const apis = createComputeApis();
        if (!apis) {
          return;
        }

        const { miscellaneousApi, projectsApi, authToken } = apis;

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
            if (createError.response && createError.response.status === 401) {
              console.error(chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".'));
            } else if (createError.response) {
              console.error(chalk.red('API Error:'), createError.response.data?.message || 'Unknown error');
            } else {
              console.error(chalk.red('Error:'), createError.message || 'Unknown error');
            }
          }
          
        } catch (error: any) {
          spinner.fail('Failed to fetch available images');
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
