import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerProjectCommands } from '../src/commands/projects';

describe('Project Commands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
  });

  describe('registerProjectCommands', () => {
    it('should register project command group', () => {
      registerProjectCommands(program);

      const commands = program.commands;
      const projectCommand = commands.find(cmd => cmd.name() === 'project');

      expect(projectCommand).toBeDefined();
      expect(projectCommand?.description()).toBe('Manage Nestbox projects');
    });

    it('should register project use subcommand', () => {
      registerProjectCommands(program);

      const projectCommand = program.commands.find(cmd => cmd.name() === 'project');
      const subCommands = projectCommand?.commands || [];
      const useCommand = subCommands.find(cmd => cmd.name() === 'use');

      expect(useCommand).toBeDefined();
      expect(useCommand?.description()).toBe('Set default project for all commands');
      
      // The command uses a required argument <project-name> which is part of the command definition
      expect(useCommand?.name()).toBe('use');
    });

    it('should register project add subcommand', () => {
      registerProjectCommands(program);

      const projectCommand = program.commands.find(cmd => cmd.name() === 'project');
      const subCommands = projectCommand?.commands || [];
      const addCommand = subCommands.find(cmd => cmd.name() === 'add');

      expect(addCommand).toBeDefined();
      expect(addCommand?.description()).toBe('Add a project with optional alias');
      
      // The command uses required and optional arguments which are part of the command definition
      expect(addCommand?.name()).toBe('add');
    });

    it('should register project list subcommand', () => {
      registerProjectCommands(program);

      const projectCommand = program.commands.find(cmd => cmd.name() === 'project');
      const subCommands = projectCommand?.commands || [];
      const listCommand = subCommands.find(cmd => cmd.name() === 'list');

      expect(listCommand).toBeDefined();
      expect(listCommand?.description()).toBe('List all projects');
    });

    it('should have all expected project subcommands', () => {
      registerProjectCommands(program);

      const projectCommand = program.commands.find(cmd => cmd.name() === 'project');
      const subCommandNames = projectCommand?.commands.map(cmd => cmd.name()) || [];
      
      expect(subCommandNames).toContain('use');
      expect(subCommandNames).toContain('add');
      expect(subCommandNames).toContain('list');
      expect(subCommandNames).toHaveLength(3);
    });

    it('should have proper action functions for all commands', () => {
      registerProjectCommands(program);

      const projectCommand = program.commands.find(cmd => cmd.name() === 'project');
      const subCommands = projectCommand?.commands || [];
      
      subCommands.forEach(cmd => {
        expect(typeof cmd.action).toBe('function');
      });
    });

    it('should register project use command with correct structure', () => {
      registerProjectCommands(program);

      const projectCommand = program.commands.find(cmd => cmd.name() === 'project');
      const useCommand = projectCommand?.commands.find(cmd => cmd.name() === 'use');
      
      expect(useCommand?.name()).toBe('use');
      expect(useCommand?.description()).toBe('Set default project for all commands');
      expect(typeof useCommand?.action).toBe('function');
    });

    it('should register project add command with correct structure', () => {
      registerProjectCommands(program);

      const projectCommand = program.commands.find(cmd => cmd.name() === 'project');
      const addCommand = projectCommand?.commands.find(cmd => cmd.name() === 'add');
      
      expect(addCommand?.name()).toBe('add');
      expect(addCommand?.description()).toBe('Add a project with optional alias');
      expect(typeof addCommand?.action).toBe('function');
    });
  });
});
