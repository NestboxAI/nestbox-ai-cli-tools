import { Command } from "commander";
import { registerProjectCommand } from "./generate/project";
import { registerDocProcGenerateCommand } from "./generate/docProc";
import { registerReportComposerGenerateCommand } from "./generate/reportComposer";

/**
 * Register all generate-related commands
 */
export function registerGenerateCommands(program: Command): void {
  // Create the main generate command
  const generateCommand = program
    .command("generate")
    .description("Generate new projects and components");

  // Register all subcommands
  registerProjectCommand(generateCommand);
  registerDocProcGenerateCommand(generateCommand);
  registerReportComposerGenerateCommand(generateCommand);
}
