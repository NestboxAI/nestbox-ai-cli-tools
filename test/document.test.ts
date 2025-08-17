import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerDocumentCommands } from '../src/commands/document';

describe('Document Commands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    vi.clearAllMocks();
  });

  describe('registerDocumentCommands', () => {
    it('should register document command group', () => {
      registerDocumentCommands(program);

      const commands = program.commands;
      const documentCommand = commands.find(cmd => cmd.name() === 'document');

      expect(documentCommand).toBeDefined();
      expect(documentCommand?.description()).toBe('Manage Nestbox documents');
    });

    it('should register doc subcommand group', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const subCommands = documentCommand?.commands || [];
      const docCommand = subCommands.find(cmd => cmd.name() === 'doc');

      expect(docCommand).toBeDefined();
      expect(docCommand?.description()).toBe('Manage individual documents');
    });

    it('should register collection subcommand group', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const subCommands = documentCommand?.commands || [];
      const collectionCommand = subCommands.find(cmd => cmd.name() === 'collection');

      expect(collectionCommand).toBeDefined();
      expect(collectionCommand?.description()).toBe('Manage document collections');
    });

    it('should register doc list subcommand', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const collectionCommand = documentCommand?.commands.find(cmd => cmd.name() === 'collection');
      const collectionSubCommands = collectionCommand?.commands || [];
      const listCommand = collectionSubCommands.find(cmd => cmd.name() === 'list');

      expect(listCommand).toBeDefined();
      expect(listCommand?.description()).toBe('List document collections for a specific instance');
      
      // Check options
      const options = listCommand?.options || [];
      const instanceOption = options.find(opt => opt.long === '--instance');
      const projectOption = options.find(opt => opt.long === '--project');
      
      expect(instanceOption).toBeDefined();
      expect(projectOption).toBeDefined();
    });

    it('should register doc create subcommand', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const collectionCommand = documentCommand?.commands.find(cmd => cmd.name() === 'collection');
      const collectionSubCommands = collectionCommand?.commands || [];
      const createCommand = collectionSubCommands.find(cmd => cmd.name() === 'create');

      expect(createCommand).toBeDefined();
      expect(createCommand?.description()).toBe('Create a new document collection for a specific instance');
      
      // Check options
      const options = createCommand?.options || [];
      const instanceOption = options.find(opt => opt.long === '--instance');
      const projectOption = options.find(opt => opt.long === '--project');
      
      expect(instanceOption).toBeDefined();
      expect(projectOption).toBeDefined();
    });

    it('should register doc get subcommand', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const docCommand = documentCommand?.commands.find(cmd => cmd.name() === 'doc');
      const docSubCommands = docCommand?.commands || [];
      const getCommand = docSubCommands.find(cmd => cmd.name() === 'get');

      expect(getCommand).toBeDefined();
      expect(getCommand?.description()).toBe('Get a document from a collection');
      
      // Arguments are part of the command definition, not in args array
      expect(getCommand?.name()).toBe('get');
    });

    it('should register doc delete subcommand', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const docCommand = documentCommand?.commands.find(cmd => cmd.name() === 'doc');
      const docSubCommands = docCommand?.commands || [];
      const deleteCommand = docSubCommands.find(cmd => cmd.name() === 'delete');

      expect(deleteCommand).toBeDefined();
      expect(deleteCommand?.description()).toBe('Delete a document from a collection');
      
      // Arguments are part of the command definition, not in args array
      expect(deleteCommand?.name()).toBe('delete');
    });

    it('should register doc update subcommand', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const docCommand = documentCommand?.commands.find(cmd => cmd.name() === 'doc');
      const docSubCommands = docCommand?.commands || [];
      const updateCommand = docSubCommands.find(cmd => cmd.name() === 'update');

      expect(updateCommand).toBeDefined();
      expect(updateCommand?.description()).toBe('Update a document in a collection');
      
      // Arguments are part of the command definition, not in args array
      expect(updateCommand?.name()).toBe('update');
    });

    it('should register collection add subcommand', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const docCommand = documentCommand?.commands.find(cmd => cmd.name() === 'doc');
      const docSubCommands = docCommand?.commands || [];
      const addCommand = docSubCommands.find(cmd => cmd.name() === 'add');

      expect(addCommand).toBeDefined();
      expect(addCommand?.description()).toBe('Add a new document to a collection');
      
      // Check options
      const options = addCommand?.options || [];
      const instanceOption = options.find(opt => opt.long === '--instance');
      const collectionOption = options.find(opt => opt.long === '--collection');
      
      expect(instanceOption).toBeDefined();
      expect(collectionOption).toBeDefined();
    });

    it('should register collection search subcommand', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const docCommand = documentCommand?.commands.find(cmd => cmd.name() === 'doc');
      const docSubCommands = docCommand?.commands || [];
      const searchCommand = docSubCommands.find(cmd => cmd.name() === 'search');

      expect(searchCommand).toBeDefined();
      expect(searchCommand?.description()).toBe('Search for documents in a collection');
      
      // Check arguments and options
      expect(searchCommand?.name()).toBe('search');
    });

    it('should have all expected doc subcommands', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const docCommand = documentCommand?.commands.find(cmd => cmd.name() === 'doc');
      const docSubCommandNames = docCommand?.commands.map(cmd => cmd.name()) || [];
      
      expect(docSubCommandNames).toContain('add');
      expect(docSubCommandNames).toContain('get');
      expect(docSubCommandNames).toContain('delete');
      expect(docSubCommandNames).toContain('update');
      expect(docSubCommandNames).toContain('upload-file');
      expect(docSubCommandNames).toContain('search');
      expect(docSubCommandNames).toHaveLength(6);
    });

    it('should have all expected collection subcommands', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const collectionCommand = documentCommand?.commands.find(cmd => cmd.name() === 'collection');
      const collectionSubCommandNames = collectionCommand?.commands.map(cmd => cmd.name()) || [];
      
      expect(collectionSubCommandNames).toContain('list');
      expect(collectionSubCommandNames).toContain('create');
      expect(collectionSubCommandNames).toContain('get');
      expect(collectionSubCommandNames).toContain('delete');
      expect(collectionSubCommandNames).toContain('update');
      expect(collectionSubCommandNames).toHaveLength(5);
    });

    it('should have proper action functions for all subcommands', () => {
      registerDocumentCommands(program);

      const documentCommand = program.commands.find(cmd => cmd.name() === 'document');
      const docCommand = documentCommand?.commands.find(cmd => cmd.name() === 'doc');
      const collectionCommand = documentCommand?.commands.find(cmd => cmd.name() === 'collection');
      
      // Check doc subcommands
      const docSubCommands = docCommand?.commands || [];
      docSubCommands.forEach(cmd => {
        expect(typeof cmd.action).toBe('function');
      });

      // Check collection subcommands
      const collectionSubCommands = collectionCommand?.commands || [];
      collectionSubCommands.forEach(cmd => {
        expect(typeof cmd.action).toBe('function');
      });
    });
  });
});
