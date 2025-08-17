import { Command } from "commander";
import { registerLoginCommand } from "./auth/login";
import { registerLogoutCommand } from "./auth/logout";

/**
 * Register all auth-related commands
 */
export function registerAuthCommands(program: Command): void {
  // Register auth commands directly on the program (not as subcommands)
  registerLoginCommand(program);
  registerLogoutCommand(program);
}