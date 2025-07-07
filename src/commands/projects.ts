import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { getAuthToken } from '../utils/auth';
import { Configuration, ProjectsApi } from '@nestbox-ai/admin';

// Define a type for the projects configuration
interface ProjectsConfig {
    default?: string;
    [key: string]: string | undefined;
}

interface NestboxConfig {
    projects: ProjectsConfig;
}

// Utility functions for project configuration
export function getNestboxConfigPath(): string {
    return path.join(process.cwd(), '.nestboxrc');
}

export function readNestboxConfig(): NestboxConfig {
    const configPath = getNestboxConfigPath();
    if (fs.existsSync(configPath)) {
        try {
            const content = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return { projects: {} };
        }
    }
    return { projects: {} };
}

export function writeNestboxConfig(config: NestboxConfig): void {
    const configPath = getNestboxConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function registerProjectCommands(program: Command): void {

    const authToken = getAuthToken();
    const configuration = new Configuration({
        basePath: authToken?.serverUrl,
        baseOptions:{
            headers: {
                "Authorization": authToken?.token,
            }
        }
    });

    const projectsApi = new ProjectsApi(configuration);

    // Create the main project command
    const projectCommand = program
        .command('project')
        .description('Manage Nestbox projects');

    // Add the basic 'use' subcommand
    projectCommand
        .command('use <project-name>')
        .description('Set default project for all commands')
        .action((projectName: string) => {
            try {
                if (!authToken) {
                    console.error(chalk.red('No authentication token found. Please log in first.'));
                    return;
                }
                const config = readNestboxConfig();

                // Set the default project
                config.projects = config.projects || {};
                config.projects.default = projectName;

                projectsApi.projectControllerGetAllProjects()
                .then((response) => {
                    // Check if the project exists
                    const projectExists = response.data.data.projects.some((project: any) => project.name === projectName);
                    if (!projectExists) {
                        throw new Error(`Project '${projectName}' does not exist.`);
                    }
                    // Write the configuration
                    writeNestboxConfig(config);
                    console.log(chalk.green(`Default project set to '${projectName}'`));
                })
                .catch((error) => {
                    if (error.response && error.response.status === 401) {
                        console.error(chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".'));
                    } else {
                        console.error(error.message);
                    }
                });

            } catch (error) {
                console.error(chalk.red('Error setting default project:'), error instanceof Error ? error.message : 'Unknown error');
            }
        });

    // Add basic 'add' subcommand
    projectCommand
        .command('add <project-name> [alias]')
        .description('Add a project with optional alias')
        .action((projectName: string, alias?: string) => {
            try {
                if (!authToken) {
                    console.error(chalk.red('No authentication token found. Please log in first.'));
                    return;
                }
                const config = readNestboxConfig();
                config.projects = config.projects || {};

                // Check if the project already exists
                if (config.projects[projectName]) {
                    console.error(chalk.red(`Project '${projectName}' already exists.`));
                    return;
                }
                // Check if the alias already exists
                if (alias && config.projects[alias]) {
                    console.error(chalk.red(`Alias '${alias}' already exists.`));
                    return;
                }

                if (alias) {
                  config.projects[alias] = projectName;
                  console.log(chalk.green(`Added project '${projectName}' with alias '${alias}'`));
                } else {
                  config.projects[projectName] = projectName;
                  console.log(chalk.green(`Added project '${projectName}'`));
                }

                // If this is the first project, set it as default
                if (!config.projects.default) {
                  config.projects.default = projectName;
                  console.log(chalk.green(`Set '${projectName}' as the default project`));
                }

                writeNestboxConfig(config);
            } catch (error) {
                console.error(chalk.red('Error adding project:'), error instanceof Error ? error.message : 'Unknown error');
            }
        });


    projectCommand
    .command('list')
    .description('List all projects')
    .action(async () => {
        try {
            if (!authToken) {
                console.error(chalk.red('No authentication token found. Please log in first.'));
                return;
            }

            // Fetch projects from API
            const response = await projectsApi.projectControllerGetAllProjects();
            const apiProjects = response.data.data.projects;

            if (!apiProjects || apiProjects.length === 0) {
                console.log(chalk.yellow('No projects found.'));
                return;
            }

            // Read local config to get default project and aliases
            const config = readNestboxConfig();
            const localProjects = config.projects || {};
            const defaultProject = localProjects.default;

            console.log(chalk.blue('Available Projects:'));
            console.log(''); // Empty line for better formatting

            // Display each project from the API
            apiProjects.forEach((project: any) => {
                const projectName = project.name;
                const isDefault = defaultProject === projectName;
                
                // Find aliases for this project
                const aliases = Object.entries(localProjects)
                    .filter(([key, value]) => value === projectName && key !== 'default' && key !== projectName)
                    .map(([alias]) => alias);

                // Build the display line
                let displayLine = `  ${projectName}`;
                
                if (aliases.length > 0) {
                    displayLine += chalk.gray(` (aliases: ${aliases.join(', ')})`);
                }
                
                if (isDefault) {
                    displayLine += chalk.green(' [DEFAULT]');
                }

                console.log(displayLine);
            });

            // Show summary
            console.log(''); // Empty line
            if (defaultProject) {
                console.log(chalk.gray(`Default project: ${defaultProject}`));
            } else {
                console.log(chalk.gray('No default project set. Use "nestbox project use <project-name>" to set one.'));
            }

        } catch (error: any) {
            if (error.response && error.response.status === 401) {
                console.error(chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".'));
            } else {
                console.error(chalk.red('Error listing projects:'), error instanceof Error ? error.message : 'Unknown error');
            }
        }
    });
}