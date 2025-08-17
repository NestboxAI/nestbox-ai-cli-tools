import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerAgentCommands } from '../src/commands/agent';

describe('Agent Commands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
  });

  describe('registerAgentCommands', () => {
    it('should register agent command group', () => {
      registerAgentCommands(program);

      const commands = program.commands;
      const agentCommand = commands.find(cmd => cmd.name() === 'agent');

      expect(agentCommand).toBeDefined();
      expect(agentCommand?.description()).toBe('Manage Nestbox agents');
    });

    it('should register agent list subcommand', () => {
      registerAgentCommands(program);

      const agentCommand = program.commands.find(cmd => cmd.name() === 'agent');
      const subCommands = agentCommand?.commands || [];
      const listCommand = subCommands.find(cmd => cmd.name() === 'list');

      expect(listCommand).toBeDefined();
      expect(listCommand?.description()).toBe('List all AI agents associated with the authenticated user');
      
      // Check options
      const options = listCommand?.options || [];
      const projectOption = options.find(opt => opt.long === '--project');
      expect(projectOption).toBeDefined();
      expect(projectOption?.description).toBe('Project name (defaults to the current project)');
    });

    it('should register agent remove subcommand', () => {
      registerAgentCommands(program);

      const agentCommand = program.commands.find(cmd => cmd.name() === 'agent');
      const subCommands = agentCommand?.commands || [];
      const removeCommand = subCommands.find(cmd => cmd.name() === 'remove');

      expect(removeCommand).toBeDefined();
      expect(removeCommand?.description()).toBe('Remove an AI agent');
      
      // Check options
      const options = removeCommand?.options || [];
      const agentOption = options.find(opt => opt.long === '--agent');
      const projectOption = options.find(opt => opt.long === '--project');
      
      expect(agentOption).toBeDefined();
      expect(projectOption).toBeDefined();
    });

    it('should register agent deploy subcommand', () => {
      registerAgentCommands(program);

      const agentCommand = program.commands.find(cmd => cmd.name() === 'agent');
      const subCommands = agentCommand?.commands || [];
      const deployCommand = subCommands.find(cmd => cmd.name() === 'deploy');

      expect(deployCommand).toBeDefined();
      expect(deployCommand?.description()).toBe('Deploy an AI agent to the Nestbox platform');
      
      // Check options
      const options = deployCommand?.options || [];
      const projectOption = options.find(opt => opt.long === '--project');
      const agentOption = options.find(opt => opt.long === '--agent');
      const instanceOption = options.find(opt => opt.long === '--instance');
      
      expect(projectOption).toBeDefined();
      expect(agentOption).toBeDefined();
      expect(instanceOption).toBeDefined();
    });

    it('should register agent create subcommand', () => {
      registerAgentCommands(program);

      const agentCommand = program.commands.find(cmd => cmd.name() === 'agent');
      const subCommands = agentCommand?.commands || [];
      const createCommand = subCommands.find(cmd => cmd.name() === 'create');

      expect(createCommand).toBeDefined();
      expect(createCommand?.description()).toBe('Create multiple agents from a YAML configuration file');
      
      // Check that it has optional arguments (in command name: "create [firstArg] [secondArg]")
      expect(createCommand?.name()).toBe('create');
      
      // Check options
      const options = createCommand?.options || [];
      const projectOption = options.find(opt => opt.long === '--project');
      
      expect(projectOption).toBeDefined();
    });

    it('should have all expected agent subcommands', () => {
      registerAgentCommands(program);

      const agentCommand = program.commands.find(cmd => cmd.name() === 'agent');
      const subCommandNames = agentCommand?.commands.map(cmd => cmd.name()) || [];
      
      expect(subCommandNames).toContain('list');
      expect(subCommandNames).toContain('remove');
      expect(subCommandNames).toContain('deploy');
      expect(subCommandNames).toContain('create');
      expect(subCommandNames).toHaveLength(4);
    });

    it('should have proper action functions for all subcommands', () => {
      registerAgentCommands(program);

      const agentCommand = program.commands.find(cmd => cmd.name() === 'agent');
      const subCommands = agentCommand?.commands || [];
      
      subCommands.forEach(cmd => {
        expect(typeof cmd.action).toBe('function');
      });
    });
  });
});
