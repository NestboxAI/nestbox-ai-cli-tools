import { Command } from "commander";
import chalk from "chalk";
import { readNestboxConfig, writeNestboxConfig } from "./config";
import { createApis } from "./apiUtils";

export function registerAddCommand(projectCommand: Command): void {
  projectCommand
    .command('add <project-name> [alias]')
    .description('Add a project with optional alias')
    .action((projectName: string, alias?: string) => {
      try {
        const apis = createApis();
        
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
}
