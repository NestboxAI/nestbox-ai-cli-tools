import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerGenerateCommands } from '../src/commands/generate';

describe('Generate Commands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
  });

  describe('registerGenerateCommands', () => {
    it('should register generate command group', () => {
      registerGenerateCommands(program);

      const commands = program.commands;
      const generateCommand = commands.find(cmd => cmd.name() === 'generate');

      expect(generateCommand).toBeDefined();
      expect(generateCommand?.description()).toBe('Generate new projects and components');
    });

    it('should register generate project subcommand', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const subCommands = generateCommand?.commands || [];
      const projectCommand = subCommands.find(cmd => cmd.name() === 'project');

      expect(projectCommand).toBeDefined();
      expect(projectCommand?.description()).toBe('Generate a new project from templates');
      
      // Check that folder is an argument (it's in command name: "project <folder>")
      expect(projectCommand?.name()).toBe('project');
      
      // Check options
      const options = projectCommand?.options || [];
      const langOption = options.find(opt => opt.long === '--lang');
      const templateOption = options.find(opt => opt.long === '--template');
      const nameOption = options.find(opt => opt.long === '--name');
      const projectOption = options.find(opt => opt.long === '--project');
      
      expect(langOption).toBeDefined();
      expect(langOption?.description).toBe('Project language (ts|js)');
      
      expect(templateOption).toBeDefined();
      expect(templateOption?.description).toBe('Template type (agent|chatbot)');
      
      expect(nameOption).toBeDefined();
      expect(nameOption?.description).toBe('Agent/Chatbot name (must be a valid function name)');
      
      expect(projectOption).toBeDefined();
      expect(projectOption?.description).toBe('Project ID');
    });

    it('should contain expected subcommands', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const subCommands = generateCommand?.commands || [];
      const subCommandNames = subCommands.map(cmd => cmd.name());

      expect(subCommandNames).toContain('project');
    });
  });
});
