import { Command } from "commander";
import { registerListCommand } from "./compute/list";
import { registerCreateCommand } from "./compute/create";
import { registerDeleteCommand } from "./compute/delete";

/**
 * Register all compute-related commands
 */
export function registerComputeProgram(program: Command): void {
  // Create the main compute command
  const computeCommand = program
    .command('compute')
    .description('Manage Nestbox computes');

  // Register all subcommands
  registerListCommand(computeCommand);
  registerCreateCommand(computeCommand);
  registerDeleteCommand(computeCommand);
}
