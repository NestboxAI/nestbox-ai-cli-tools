import { Command } from 'commander';
import {
  registerDocProcDocumentCommands,
  registerDocProcEvalCommands,
  registerDocProcHealthCommand,
  registerDocProcJobCommands,
  registerDocProcProfileCommands,
  registerDocProcQueryCommands,
  registerDocProcWebhookCommands,
} from './docProc/index';

export function registerDocProcCommands(program: Command): void {
  const docProcCommand = program
    .command('doc-proc')
    .description('Document processing commands');

  docProcCommand
    .option('--json', 'Output JSON where supported')
    .option('-v, --verbose', 'Enable verbose output');

  registerDocProcProfileCommands(docProcCommand);
  registerDocProcDocumentCommands(docProcCommand);
  registerDocProcJobCommands(docProcCommand);
  registerDocProcEvalCommands(docProcCommand);
  registerDocProcQueryCommands(docProcCommand);
  registerDocProcWebhookCommands(docProcCommand);
  registerDocProcHealthCommand(docProcCommand);
}
