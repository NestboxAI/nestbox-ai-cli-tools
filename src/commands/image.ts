import { Command } from "commander";
import { registerListCommand } from "./image/list";

/**
 * Register all image-related commands
 */
export function registerImageCommands(program: Command): void {
  // Create the main image command
  const imageCommand = program
    .command("image")
    .description("Manage Nestbox images");

  // Register all subcommands
  registerListCommand(imageCommand);
}

// Export image utilities for use in other modules
export { 
  displayImagesTable, 
  statusMappings 
} from "./image/display";
export type { ApiInstances } from "./image/apiUtils";