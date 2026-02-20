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
      expect(subCommandNames).toContain('doc-proc');
      expect(subCommandNames).toContain('report-composer');
    });
  });

  describe('generate doc-proc subcommand', () => {
    it('should register the doc-proc subcommand', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const docProcCommand = generateCommand?.commands.find(cmd => cmd.name() === 'doc-proc');

      expect(docProcCommand).toBeDefined();
    });

    it('should have the correct description', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const docProcCommand = generateCommand?.commands.find(cmd => cmd.name() === 'doc-proc');

      expect(docProcCommand?.description()).toBe(
        'Generate a document pipeline config.yaml and eval.yaml from an instructions file using Claude AI',
      );
    });

    it('should have required options: --file, --output', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const docProcCommand = generateCommand?.commands.find(cmd => cmd.name() === 'doc-proc');
      const options = docProcCommand?.options ?? [];
      const longs = options.map(o => o.long);

      expect(longs).toContain('--file');
      expect(longs).toContain('--output');
    });

    it('should have API key options: --anthropicApiKey and --openAiApiKey', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const docProcCommand = generateCommand?.commands.find(cmd => cmd.name() === 'doc-proc');
      const options = docProcCommand?.options ?? [];
      const longs = options.map(o => o.long);

      expect(longs).toContain('--anthropicApiKey');
      expect(longs).toContain('--openAiApiKey');
    });

    it('should have both API key options as optional (not mandatory)', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const docProcCommand = generateCommand?.commands.find(cmd => cmd.name() === 'doc-proc');
      const options = docProcCommand?.options ?? [];

      const anthropicOption = options.find(o => o.long === '--anthropicApiKey');
      const openAiOption = options.find(o => o.long === '--openAiApiKey');

      expect(anthropicOption?.mandatory).toBe(false);
      expect(openAiOption?.mandatory).toBe(false);
    });

    it('should have optional options: --model, --maxIterations', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const docProcCommand = generateCommand?.commands.find(cmd => cmd.name() === 'doc-proc');
      const options = docProcCommand?.options ?? [];
      const longs = options.map(o => o.long);

      expect(longs).toContain('--model');
      expect(longs).toContain('--maxIterations');
    });

    it('should have no static default for --model (provider-dependent)', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const docProcCommand = generateCommand?.commands.find(cmd => cmd.name() === 'doc-proc');
      const modelOption = docProcCommand?.options.find(o => o.long === '--model');

      expect(modelOption?.defaultValue).toBeUndefined();
    });

    it('should default maxIterations to "8"', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const docProcCommand = generateCommand?.commands.find(cmd => cmd.name() === 'doc-proc');
      const iterOption = docProcCommand?.options.find(o => o.long === '--maxIterations');

      expect(iterOption?.defaultValue).toBe('8');
    });
  });

  describe('generate report-composer subcommand', () => {
    it('should register the report-composer subcommand', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const reportComposerCommand = generateCommand?.commands.find(cmd => cmd.name() === 'report-composer');

      expect(reportComposerCommand).toBeDefined();
    });

    it('should have the correct description', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const reportComposerCommand = generateCommand?.commands.find(cmd => cmd.name() === 'report-composer');

      expect(reportComposerCommand?.description()).toBe(
        'Generate a report composer report.yaml configuration from an instructions file using Claude AI',
      );
    });

    it('should have required options: --file, --output', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const reportComposerCommand = generateCommand?.commands.find(cmd => cmd.name() === 'report-composer');
      const options = reportComposerCommand?.options ?? [];
      const longs = options.map(o => o.long);

      expect(longs).toContain('--file');
      expect(longs).toContain('--output');
    });

    it('should have API key options: --anthropicApiKey and --openAiApiKey', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const reportComposerCommand = generateCommand?.commands.find(cmd => cmd.name() === 'report-composer');
      const options = reportComposerCommand?.options ?? [];
      const longs = options.map(o => o.long);

      expect(longs).toContain('--anthropicApiKey');
      expect(longs).toContain('--openAiApiKey');
    });

    it('should have both API key options as optional (not mandatory)', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const reportComposerCommand = generateCommand?.commands.find(cmd => cmd.name() === 'report-composer');
      const options = reportComposerCommand?.options ?? [];

      const anthropicOption = options.find(o => o.long === '--anthropicApiKey');
      const openAiOption = options.find(o => o.long === '--openAiApiKey');

      expect(anthropicOption?.mandatory).toBe(false);
      expect(openAiOption?.mandatory).toBe(false);
    });

    it('should mark --file and --output as mandatory', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const reportComposerCommand = generateCommand?.commands.find(cmd => cmd.name() === 'report-composer');
      const options = reportComposerCommand?.options ?? [];

      const fileOption = options.find(o => o.long === '--file');
      const outputOption = options.find(o => o.long === '--output');

      expect(fileOption?.mandatory).toBe(true);
      expect(outputOption?.mandatory).toBe(true);
    });

    it('should have optional options: --model, --maxIterations', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const reportComposerCommand = generateCommand?.commands.find(cmd => cmd.name() === 'report-composer');
      const options = reportComposerCommand?.options ?? [];
      const longs = options.map(o => o.long);

      expect(longs).toContain('--model');
      expect(longs).toContain('--maxIterations');
    });

    it('should have no static default for --model (provider-dependent)', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const reportComposerCommand = generateCommand?.commands.find(cmd => cmd.name() === 'report-composer');
      const modelOption = reportComposerCommand?.options.find(o => o.long === '--model');

      expect(modelOption?.defaultValue).toBeUndefined();
    });

    it('should default maxIterations to "5"', () => {
      registerGenerateCommands(program);

      const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');
      const reportComposerCommand = generateCommand?.commands.find(cmd => cmd.name() === 'report-composer');
      const iterOption = reportComposerCommand?.options.find(o => o.long === '--maxIterations');

      expect(iterOption?.defaultValue).toBe('5');
    });
  });
});
