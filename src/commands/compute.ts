import { Command } from "commander";
import { getAuthToken } from "../utils/auth";
import { Configuration, ProjectsApi, MachineInstancesApi } from "@nestbox-ai/admin";
import { readNestboxConfig } from "./projects";
import chalk from "chalk";
import Table from "cli-table3";

export function registerComputeProgram(program: Command): void {

    const authToken = getAuthToken();
    const configuration = new Configuration({
        basePath: authToken?.serverUrl,
        baseOptions: {
            headers: {
                "Authorization": authToken?.token,
            }
        }
    });

    const machineInstanceApi = new MachineInstancesApi(configuration);
    const projectsApi = new ProjectsApi(configuration);

    // Create the main project command
    const projectCommand = program
        .command('compute')
        .description('Manage Nestbox computes');

    projectCommand
        .command('list')
        .description('list all instances')
        .action(() => {
            try {
                if (!authToken) {
                    console.error(chalk.red('No authentication token found. Please login first.'));
                    return;
                }
                const config = readNestboxConfig();

                // Set the default project
                config.projects = config.projects || {};

                // Get the default project name
                const defaultProjectName = config.projects.default;

                if (!defaultProjectName) {
                    console.log(chalk.yellow('No default project set. Use "nestbox project set-default <project-name>" to set a default project.'));
                    return;
                }

                console.log(chalk.blue(`Fetching compute instances for project: ${defaultProjectName}`));

                // Call API to get all projects
                const response = projectsApi.projectControllerGetAllProjects();

                response.then((response) => {
                    // Check if the response contains projects
                    if (response.data && response.data.data && response.data.data.projects && response.data.data.projects.length > 0) {
                        const defaultProject = response.data.data.projects.find(
                            (project) => project.name === defaultProjectName
                        );
                        
                        if (defaultProject) {
                            const machineInstancesResponse = machineInstanceApi.machineInstancesControllerGetMachineInstanceByUserId(
                                defaultProject.id,
                                0,
                                10
                            );
                            
                            machineInstancesResponse.then((instancesResponse: any) => {
                                if (instancesResponse.data && instancesResponse.data.machineInstances) {
                                    const instances = instancesResponse.data.machineInstances;
                                    
                                    if (instances.length === 0) {
                                        console.log(chalk.yellow('No compute instances found for this project.'));
                                        return;
                                    }
                                    
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
                                    
                                    // Add rows to the table
                                    instances.forEach((instance: any) => {
                                        // Color the status based on its value
                                        let statusColor;
                                        const status = instance.runningStatus?.toLowerCase() || 'unknown';
                                        
                                        switch(true) {
                                            case status.includes('executed'):
                                                statusColor = chalk.green(instance.runningStatus);
                                                break;
                                            case status.includes('failed') || status.includes('error'):
                                                statusColor = chalk.red(instance.runningStatus);
                                                break;
                                            case status.includes('running') || status.includes('started'):
                                                statusColor = chalk.green(instance.runningStatus);
                                                break;
                                            case status.includes('stopped'):
                                                statusColor = chalk.red(instance.runningStatus);
                                                break;
                                            case status.includes('starting') || status.includes('pending'):
                                                statusColor = chalk.yellow(instance.runningStatus);
                                                break;
                                            default:
                                                statusColor = chalk.gray(instance.runningStatus || 'unknown');
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
                                } else {
                                    console.log(chalk.yellow('No compute instance data returned from the API.'));
                                }
                            }).catch((error) => {
                                console.error(chalk.red('Error fetching compute instances:'), error instanceof Error ? error.message : 'Unknown error');
                            });
                        } else {
                            console.log(chalk.yellow(`Default project "${defaultProjectName}" not found among available projects.`));
                        }
                    } else {
                        console.log(chalk.yellow('No projects found.'));
                    }
                }).catch((error) => {
                    console.error(chalk.red('Error fetching projects:'), error instanceof Error ? error.message : 'Unknown error');
                });

            } catch (error) {
                console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            }
        });
}