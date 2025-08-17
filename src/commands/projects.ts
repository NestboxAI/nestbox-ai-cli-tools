import { Command } from "commander";
import { registerUseCommand } from "./project/use";
import { registerAddCommand } from "./project/add";
import { registerListCommand } from "./project/list";

/**
 * Register all project-related commands
 */
export function registerProjectCommands(program: Command): void {
  // Create the main project command
  const projectCommand = program
    .command("project")
    .description("Manage Nestbox projects");

  // Register all subcommands
  registerUseCommand(projectCommand);
  registerAddCommand(projectCommand);
  registerListCommand(projectCommand);
}

// Export project utilities for use in other modules
export { 
  readNestboxConfig, 
  writeNestboxConfig, 
  getNestboxConfigPath,
  type ProjectsConfig,
  type NestboxConfig 
} from "./project";