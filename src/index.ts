#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { registerAuthCommands } from './commands/auth';
import { registerProjectCommands } from './commands/projects';
import { registerComputeProgram } from './commands/compute';
import { registerDocumentCommands } from './commands/document';
import { registerImageCommands } from './commands/image';
import { registerAgentCommands } from './commands/agent';

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// Setup the CLI program
const program = new Command();
program
  .name('nestbox')
  .description('CLI tool for the Nestbox AI platform')
  .version(packageJson.version);

// Register command groups
registerAuthCommands(program);
registerProjectCommands(program);
registerComputeProgram(program);
registerAgentCommands(program);
registerDocumentCommands(program);
registerImageCommands(program);

// Parse command line arguments
program.parse(process.argv);

// Only show help if no arguments were provided
if (process.argv.length === 2) {
  program.help();
}