import { Command } from "commander";
import {
  registerCollectionListCommand,
  registerCollectionCreateCommand,
  registerCollectionGetCommand,
  registerCollectionDeleteCommand,
  registerCollectionUpdateCommand,
  registerDocAddCommand,
  registerDocGetCommand,
  registerDocDeleteCommand,
  registerDocUpdateCommand,
  registerDocUploadFileCommand,
  registerDocSearchCommand
} from "./document/index";

/**
 * Register all document-related commands
 */
export function registerDocumentCommands(program: Command): void {
  // Create the main document command
  const documentCommand = program
    .command("document")
    .description("Manage Nestbox documents");

  // Create subcommands for collections and docs
  const collectionCommand = documentCommand
    .command("collection")
    .description("Manage document collections");
  
  const docCommand = documentCommand
    .command("doc")
    .description("Manage individual documents");

  // Register all collection subcommands
  registerCollectionListCommand(collectionCommand);
  registerCollectionCreateCommand(collectionCommand);
  registerCollectionGetCommand(collectionCommand);
  registerCollectionDeleteCommand(collectionCommand);
  registerCollectionUpdateCommand(collectionCommand);

  // Register all document subcommands
  registerDocAddCommand(docCommand);
  registerDocGetCommand(docCommand);
  registerDocDeleteCommand(docCommand);
  registerDocUpdateCommand(docCommand);
  registerDocUploadFileCommand(docCommand);
  registerDocSearchCommand(docCommand);
}