import { Command } from "commander";
import { registerListCommand } from "./agent/list";
import { registerRemoveCommand } from "./agent/remove";
import { registerDeployCommand } from "./agent/deploy";
import { registerCreateFromYamlCommand } from "./agent/createFromYaml";

/**
 * Register all agent-related commands
 */
export function registerAgentCommands(program: Command): void {
  // Create the main agent command
  const agentCommand = program
    .command("agent")
    .description("Manage Nestbox agents");

  // Register all subcommands
  registerListCommand(agentCommand);
  registerRemoveCommand(agentCommand);
  registerDeployCommand(agentCommand);
  registerCreateFromYamlCommand(agentCommand);
}
