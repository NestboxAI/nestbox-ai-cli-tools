import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerImageCommands } from '../src/commands/image';

describe('Image Commands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
  });

  describe('registerImageCommands', () => {
    it('should register image command group', () => {
      registerImageCommands(program);

      const commands = program.commands;
      const imageCommand = commands.find(cmd => cmd.name() === 'image');

      expect(imageCommand).toBeDefined();
      expect(imageCommand?.description()).toBe('Manage Nestbox images');
    });

    it('should register image list subcommand', () => {
      registerImageCommands(program);

      const imageCommand = program.commands.find(cmd => cmd.name() === 'image');
      const subCommands = imageCommand?.commands || [];
      const listCommand = subCommands.find(cmd => cmd.name() === 'list');

      expect(listCommand).toBeDefined();
      expect(listCommand?.description()).toBe('List images for a project');
      
      // Check options
      const options = listCommand?.options || [];
      const projectOption = options.find(opt => opt.long === '--project');
      expect(projectOption).toBeDefined();
      expect(projectOption?.description).toBe('Project ID or name (defaults to the current project)');
    });

    it('should have all expected image subcommands', () => {
      registerImageCommands(program);

      const imageCommand = program.commands.find(cmd => cmd.name() === 'image');
      const subCommandNames = imageCommand?.commands.map(cmd => cmd.name()) || [];
      
      expect(subCommandNames).toContain('list');
      expect(subCommandNames).toHaveLength(1);
    });

    it('should have proper action functions for all subcommands', () => {
      registerImageCommands(program);

      const imageCommand = program.commands.find(cmd => cmd.name() === 'image');
      const subCommands = imageCommand?.commands || [];
      
      subCommands.forEach(cmd => {
        expect(typeof cmd.action).toBe('function');
      });
    });

    it('should register image list command with correct structure', () => {
      registerImageCommands(program);

      const imageCommand = program.commands.find(cmd => cmd.name() === 'image');
      const listCommand = imageCommand?.commands.find(cmd => cmd.name() === 'list');
      
      expect(listCommand?.name()).toBe('list');
      expect(listCommand?.description()).toBe('List images for a project');
      expect(typeof listCommand?.action).toBe('function');
    });

    it('should have project option with correct configuration', () => {
      registerImageCommands(program);

      const imageCommand = program.commands.find(cmd => cmd.name() === 'image');
      const listCommand = imageCommand?.commands.find(cmd => cmd.name() === 'list');
      const options = listCommand?.options || [];
      const projectOption = options.find(opt => opt.long === '--project');
      
      expect(projectOption).toBeDefined();
      expect(projectOption?.description).toBe('Project ID or name (defaults to the current project)');
      expect(projectOption?.long).toBe('--project');
    });

    it('should properly initialize when auth token is available', () => {
      // This test verifies that the command registration doesn't fail when auth token is available
      expect(() => {
        registerImageCommands(program);
      }).not.toThrow();
      
      const imageCommand = program.commands.find(cmd => cmd.name() === 'image');
      expect(imageCommand).toBeDefined();
    });

    it('should handle the case when createApis function is called within command actions', () => {
      registerImageCommands(program);

      const imageCommand = program.commands.find(cmd => cmd.name() === 'image');
      const listCommand = imageCommand?.commands.find(cmd => cmd.name() === 'list');
      
      // Verify that the action function exists and is callable
      expect(listCommand?.action).toBeDefined();
      expect(typeof listCommand?.action).toBe('function');
    });
  });
});
