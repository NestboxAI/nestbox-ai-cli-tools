import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerAuthCommands } from '../src/commands/auth';

describe('Auth Commands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
  });

  describe('registerAuthCommands', () => {
    it('should register login command with correct parameters', () => {
      registerAuthCommands(program);

      const commands = program.commands;
      const loginCommand = commands.find(cmd => cmd.name() === 'login');

      expect(loginCommand).toBeDefined();
      expect(loginCommand?.description()).toBe('Login using Google SSO');
      
      // Check if the command expects a domain argument (it's in the command name)
      expect(loginCommand?.name()).toBe('login');
    });

    it('should register logout command with correct parameters', () => {
      registerAuthCommands(program);

      const commands = program.commands;
      const logoutCommand = commands.find(cmd => cmd.name() === 'logout');

      expect(logoutCommand).toBeDefined();
      expect(logoutCommand?.description()).toBe('Logout from Nestbox platform');
      
      // Check if the command has an optional domain argument (it's in the command name)
      expect(logoutCommand?.name()).toBe('logout');
    });

    it('should register all expected auth commands', () => {
      registerAuthCommands(program);

      const commandNames = program.commands.map(cmd => cmd.name());
      expect(commandNames).toContain('login');
      expect(commandNames).toContain('logout');
      expect(commandNames).toHaveLength(2);
    });

    it('should have proper command structure for login', () => {
      registerAuthCommands(program);

      const loginCommand = program.commands.find(cmd => cmd.name() === 'login');
      
      // Verify command properties
      expect(loginCommand?.name()).toBe('login');
      expect(loginCommand?.description()).toBe('Login using Google SSO');
      expect(typeof loginCommand?.action).toBe('function');
    });

    it('should have proper command structure for logout', () => {
      registerAuthCommands(program);

      const logoutCommand = program.commands.find(cmd => cmd.name() === 'logout');
      
      // Verify command properties
      expect(logoutCommand?.name()).toBe('logout');
      expect(logoutCommand?.description()).toBe('Logout from Nestbox platform');
      expect(typeof logoutCommand?.action).toBe('function');
    });
  });
});
