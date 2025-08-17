import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerComputeProgram } from '../src/commands/compute';

describe('Compute Commands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
  });

  describe('registerComputeProgram', () => {
    it('should register compute command group', () => {
      registerComputeProgram(program);

      const commands = program.commands;
      const computeCommand = commands.find(cmd => cmd.name() === 'compute');

      expect(computeCommand).toBeDefined();
      expect(computeCommand?.description()).toBe('Manage Nestbox computes');
    });

    it('should register compute list subcommand', () => {
      registerComputeProgram(program);

      const computeCommand = program.commands.find(cmd => cmd.name() === 'compute');
      const subCommands = computeCommand?.commands || [];
      const listCommand = subCommands.find(cmd => cmd.name() === 'list');

      expect(listCommand).toBeDefined();
      expect(listCommand?.description()).toBe('List all compute instances');
      
      // Check options
      const options = listCommand?.options || [];
      const projectOption = options.find(opt => opt.long === '--project');
      expect(projectOption).toBeDefined();
      expect(projectOption?.description).toBe('Project ID or name (defaults to the current project)');
    });

    it('should register compute create subcommand', () => {
      registerComputeProgram(program);

      const computeCommand = program.commands.find(cmd => cmd.name() === 'compute');
      const subCommands = computeCommand?.commands || [];
      const createCommand = subCommands.find(cmd => cmd.name() === 'create');

      expect(createCommand).toBeDefined();
      expect(createCommand?.description()).toBe('Create a new compute instance');
      
      // Check options
      const options = createCommand?.options || [];
      const projectOption = options.find(opt => opt.long === '--project');
      const imageOption = options.find(opt => opt.long === '--image');
      
      expect(projectOption).toBeDefined();
      expect(imageOption).toBeDefined();
    });

    it('should register compute delete subcommand', () => {
      registerComputeProgram(program);

      const computeCommand = program.commands.find(cmd => cmd.name() === 'compute');
      const subCommands = computeCommand?.commands || [];
      const deleteCommand = subCommands.find(cmd => cmd.name() === 'delete');

      expect(deleteCommand).toBeDefined();
      expect(deleteCommand?.description()).toBe('Delete one or more compute instances');
      
      // Check options
      const options = deleteCommand?.options || [];
      const projectOption = options.find(opt => opt.long === '--project');
      const forceOption = options.find(opt => opt.long === '--force');
      
      expect(projectOption).toBeDefined();
      expect(forceOption).toBeDefined();
    });

    it('should have all expected compute subcommands', () => {
      registerComputeProgram(program);

      const computeCommand = program.commands.find(cmd => cmd.name() === 'compute');
      const subCommandNames = computeCommand?.commands.map(cmd => cmd.name()) || [];
      
      expect(subCommandNames).toContain('list');
      expect(subCommandNames).toContain('create');
      expect(subCommandNames).toContain('delete');
      expect(subCommandNames).toHaveLength(3);
    });

    it('should have proper action functions for all subcommands', () => {
      registerComputeProgram(program);

      const computeCommand = program.commands.find(cmd => cmd.name() === 'compute');
      const subCommands = computeCommand?.commands || [];
      
      subCommands.forEach(cmd => {
        expect(typeof cmd.action).toBe('function');
      });
    });

    it('should register compute list command with correct structure', () => {
      registerComputeProgram(program);

      const computeCommand = program.commands.find(cmd => cmd.name() === 'compute');
      const listCommand = computeCommand?.commands.find(cmd => cmd.name() === 'list');
      
      expect(listCommand?.name()).toBe('list');
      expect(listCommand?.description()).toBe('List all compute instances');
      expect(typeof listCommand?.action).toBe('function');
    });

    it('should register compute create command with correct structure', () => {
      registerComputeProgram(program);

      const computeCommand = program.commands.find(cmd => cmd.name() === 'compute');
      const createCommand = computeCommand?.commands.find(cmd => cmd.name() === 'create');
      
      expect(createCommand?.name()).toBe('create');
      expect(createCommand?.description()).toBe('Create a new compute instance');
      expect(typeof createCommand?.action).toBe('function');
    });

    it('should register compute delete command with correct structure', () => {
      registerComputeProgram(program);

      const computeCommand = program.commands.find(cmd => cmd.name() === 'compute');
      const deleteCommand = computeCommand?.commands.find(cmd => cmd.name() === 'delete');
      
      expect(deleteCommand?.name()).toBe('delete');
      expect(deleteCommand?.description()).toBe('Delete one or more compute instances');
      expect(typeof deleteCommand?.action).toBe('function');
    });
  });
});
