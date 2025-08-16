import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getAuthToken } from '../utils/auth';
import { Configuration, DocumentsApi, ProjectsApi } from '@nestbox-ai/admin';
import { readNestboxConfig } from './projects';
import { resolveProject } from '../utils/project';
import { handle401Error } from '../utils/error';


/**
 * Executes an async command with proper error handling and spinner feedback
 */
async function executeCommand<T>(
  description: string, 
  command: () => Promise<T>, 
  successMessage: string
): Promise<T> {
  const spinner = ora(description).start();
  
  try {
    const result = await command();
    spinner.succeed(successMessage);
    return result;
  } catch (error: any) {
    spinner.fail('Operation failed');
    handle401Error(error);
    if (error.response?.data?.message) {
      console.error(chalk.red('API Error:'), error.response.data.message);
    } else {
      console.error(chalk.red('Error:'), error.message || 'Unknown error');
    }
    throw error;
  }
}

export function registerDocumentCommands(program: Command): void {
  const authToken = getAuthToken();

  if (!authToken) {
    console.error(chalk.red('No authentication token found. Please login first.'));
    return;
  }

  const configuration = new Configuration({
    basePath: authToken.serverUrl,
    baseOptions: {
      headers: {
        Authorization: authToken.token,
      },
    },
  });

  const documentsApi = new DocumentsApi(configuration);
  const projectsApi = new ProjectsApi(configuration);

  const documentCommand = program.command('document').description('Manage Nestbox documents');
  const docCommand = documentCommand.command('doc').description('Manage individual documents');
  const collectionCommand = documentCommand.command('collection').description('Manage document collections');

  // Add shared options to parent command that will be inherited by all subcommands
  const addSharedOptions = (cmd: Command) => 
    cmd
      .requiredOption('--instance <instanceId>', 'Instance ID')
      .option('--project <projectId>', 'Project ID or name (defaults to the current project)');

  // LIST command
  const listCmd = collectionCommand
    .command('list')
    .description('List document collections for a specific instance');
  
  addSharedOptions(listCmd);
  
  listCmd.action(async (options) => {
    try {
      const project = await resolveProject(projectsApi, options);
      
      const collections = await executeCommand(
        `Listing document collections for instance ${options.instance} in project ${project.name}...`,
        async () => {
          const response: any = await documentsApi.documentControllerGetAllCollections(project.id, options.instance);
          return Array.isArray(response.data?.collections) ? response.data.collections : [];
        },
        'Successfully retrieved document collections'
      );

      if (collections.length === 0) {
        console.log(chalk.yellow(`No document collections found for instance ${options.instance} in project ${project.name}`));
        return;
      }

      console.log(chalk.blue(`\nDocument collections for instance ${options.instance} in project ${project.name}:\n`));

      collections.forEach((collection: any) => {
        const name = typeof collection === 'string' ? collection : collection?.name || 'Unnamed Collection';
        console.log(chalk.white.bold(name));
      });
    } catch (error) {
      // Error already handled by executeCommand
    }
  });

  // CREATE command
  const createCmd = collectionCommand
    .command('create')
    .description('Create a new document collection for a specific instance')
    .requiredOption('--name <name>', 'Name of the document collection')
    .option('--metadata <json>', 'Metadata for the document collection in JSON format');
  
  addSharedOptions(createCmd);
  
  createCmd.action(async (options) => {
    try {
      const project = await resolveProject(projectsApi, options);
      
      await executeCommand(
        `Creating document collection "${options.name}" for instance ${options.instance} in project ${project.name}...`,
        async () => {
          const metadataObj = options.metadata ? JSON.parse(options.metadata) : {};
          await documentsApi.documentControllerCreateCollection(project.id, options.instance, {
            name: options.name,
            metadata: metadataObj,
          });
        },
        'Successfully created document collection'
      );

      console.log(chalk.green(`Document collection "${options.name}" created successfully.`));
    } catch (error) {
      // Error already handled by executeCommand
    }
  });

  // GET command
  const getCmd = collectionCommand
    .command('get')
    .description('Get details of a specific document collection for a specific instance')
    .requiredOption('--collection <collectionId>', 'ID of the document collection to get');
  
  addSharedOptions(getCmd);
  
  getCmd.action(async (options) => {
    try {
      const project = await resolveProject(projectsApi, options);
      
      const collectionDetails = await executeCommand(
        `Getting document collection "${options.collection}" for instance ${options.instance} in project ${project.name}...`,
        async () => {
          const response = await documentsApi.documentControllerGetCollectionInfo(
            project.id, 
            options.instance, 
            options.collection
          );
          return response.data;
        },
        'Successfully retrieved document collection'
      );

      console.log(chalk.blue(`\nDocument collection details for instance ${options.instance} in project ${project.name}:\n`));
      console.log(JSON.stringify(collectionDetails, null, 2));
    } catch (error) {
      // Error already handled by executeCommand
    }
  });

  // DELETE command
  const deleteCmd = collectionCommand
    .command('delete')
    .description('Delete a document collection for a specific instance')
    .requiredOption('--collection <collectionId>', 'ID of the document collection to delete');
  
  addSharedOptions(deleteCmd);
  
  deleteCmd.action(async (options) => {
    try {
      const project = await resolveProject(projectsApi, options);
      
      await executeCommand(
        `Deleting document collection "${options.collection}" for instance ${options.instance} in project ${project.name}...`,
        async () => {
          await documentsApi.documentControllerDeleteCollection(
            project.id, 
            options.instance, 
            options.collection
          );
        },
        'Successfully deleted document collection'
      );

      console.log(chalk.green(`Document collection "${options.collection}" deleted successfully.`));
    } catch (error) {
      // Error already handled by executeCommand
    }
  });

  // UPDATE command
  const updateCmd = collectionCommand
    .command('update')
    .description('Update a document collection for a specific instance')
    .requiredOption('--collection <collectionId>', 'ID of the document collection to update')
    .option('--name <name>', 'New name of the document collection')
    .option('--metadata <json>', 'New metadata for the document collection in JSON format');
  
  addSharedOptions(updateCmd);
  
  updateCmd.action(async (options) => {
    try {
      const project = await resolveProject(projectsApi, options);
      
      await executeCommand(
        `Updating document collection "${options.collection}" for instance ${options.instance} in project ${project.name}...`,
        async () => {
          const metadataObj = options.metadata ? JSON.parse(options.metadata) : {};
          
          await documentsApi.documentControllerUpdateCollection(
            project.id, 
            options.instance, 
            options.collection, 
            {
              name: options.name,
              metadata: metadataObj,
            }
          );
        },
        'Successfully updated document collection'
      );

      console.log(chalk.green(`Document collection "${options.collection}" updated successfully.`));
    } catch (error) {
      // Error already handled by executeCommand
    }
  });


  const addDocCmd = docCommand
  .command('add')
  .description('Add a new document to a collection')
  .requiredOption('--instance <instanceId>', 'Instance ID')
  .requiredOption('--collection <collectionId>', 'Collection ID')
  .requiredOption('--id <id>', 'Document ID')
  .requiredOption('--document <json>', 'Document content in JSON format')
  .option('--metadata <json>', 'Document metadata in JSON format (optional)')
  .option('--project <projectId>', 'Project ID or name (defaults to the current project)');

addDocCmd.action(async (options) => {
  try {
    const project = await resolveProject(projectsApi, options);
    
    await executeCommand(
      `Adding document to collection "${options.collection}" in instance ${options.instance}...`,
      async () => {
        const documentContent = JSON.parse(options.document);
        const metadata = options.metadata ? JSON.parse(options.metadata) : {};
        
        await documentsApi.documentControllerAddDocToCollection(
          project.id, 
          options.instance, 
          options.collection, 
          {
            id: options.id,
            document: JSON.stringify(documentContent),
            metadata: metadata
          }
        );
      },
      'Successfully added document to collection'
    );

    console.log(chalk.green(`Document with ID "${options.id}" added successfully to collection "${options.collection}".`));
  } catch (error) {
    // Error already handled by executeCommand
  }
});

const getDocCmd = docCommand
  .command('get')
  .description('Get a document from a collection')
  .requiredOption('--instance <instanceId>', 'Instance ID')
  .requiredOption('--collection <collectionId>', 'Collection ID')
  .requiredOption('--doc <docId>', 'Document ID')
  .option('--project <projectId>', 'Project ID or name (defaults to the current project)');
getDocCmd.action(async (options) => {
  try {
    const project = await resolveProject(projectsApi, options);
    
    const document = await executeCommand(
      `Getting document "${options.doc}" from collection "${options.collection}" in instance ${options.instance}...`,
      async () => {
        const response = await documentsApi.documentControllerGetDocById(
          project.id, 
          options.instance, 
          options.collection, 
          options.doc
        );
        return response.data;
      },
      'Successfully retrieved document'
    );

    console.log(chalk.blue(`\nDocument details for ID "${options.doc}" in collection "${options.collection}":\n`));
    console.log(JSON.stringify(document, null, 2));
  } catch (error) {
    // Error already handled by executeCommand
  }
});

const deleteDocCmd = docCommand
  .command('delete')
  .description('Delete a document from a collection')
  .requiredOption('--instance <instanceId>', 'Instance ID')
  .requiredOption('--collection <collectionId>', 'Collection ID')
  .requiredOption('--doc <docId>', 'Document ID')
  .option('--project <projectId>', 'Project ID or name (defaults to the current project)');
deleteDocCmd.action(async (options) => {
  try {
    const project = await resolveProject(projectsApi, options);
    
    await executeCommand(
      `Deleting document "${options.doc}" from collection "${options.collection}" in instance ${options.instance}...`,
      async () => {
        await documentsApi.documentControllerDeleteDocById(
          project.id, 
          options.instance, 
          options.collection, 
          options.doc
        );
      },
      'Successfully deleted document'
    );

    console.log(chalk.green(`Document with ID "${options.doc}" deleted successfully from collection "${options.collection}".`));
  } catch (error) {
    // Error already handled by executeCommand
  }
});

const updateDocCmd = docCommand
  .command('update')
  .description('Update a document in a collection')
  .requiredOption('--instance <instanceId>', 'Instance ID')
  .requiredOption('--collection <collectionId>', 'Collection ID')
  .requiredOption('--doc <docId>', 'Document ID')
  .requiredOption('--document <string>', 'Updated document content as a string')
  .option('--metadata <json>', 'Updated document metadata in JSON format (optional)')
  .option('--project <projectId>', 'Project ID or name (defaults to the current project)');

updateDocCmd.action(async (options) => {  
  try {
    const project = await resolveProject(projectsApi, options);
    
    await executeCommand(
      `Updating document "${options.doc}" in collection "${options.collection}" in instance ${options.instance}...`,
      async () => {
        const documentContent = options.document;
        const metadata = options.metadata ? JSON.parse(options.metadata) : {};
        
        await documentsApi.documentControllerUpdateDoc(
          project.id, 
          options.instance, 
          options.collection, 
          options.doc,
          {
            document: documentContent,
            metadata: metadata
          }
        );
      },
      'Successfully updated document'
    );

    console.log(chalk.green(`Document with ID "${options.doc}" updated successfully in collection "${options.collection}".`));
  } catch (error) {
    // Error already handled by executeCommand
  }
});

const uploadFileCmd = docCommand
  .command('upload-file')
  .description('Add documents by file chunking')
  .requiredOption('--instance <instanceId>', 'Instance ID')
  .requiredOption('--collection <collectionId>', 'Collection ID')
  .requiredOption('--file <path>', 'Path to the file to upload')
  .option('--type <fileType>', 'Type of the file (e.g., pdf, txt, doc)')
  .option('--options <json>', 'Additional options for file processing in JSON format')
  .option('--project <projectId>', 'Project ID or name (defaults to the current project)');
  
uploadFileCmd.action(async (options) => { 
  try {
    const project = await resolveProject(projectsApi, options);
    
    await executeCommand(
      `Processing file "${options.file}" for collection "${options.collection}" in instance ${options.instance}...`,
      async () => {
        
        const requestData = {
          type: options.type,
          url: options.file,
          options: options.options ? JSON.parse(options.options) : {},
        };
        
        await documentsApi.documentControllerAddDocToCollectionFromFile(
          project.id, 
          options.instance, 
          options.collection, 
          requestData
        );
      },
      'Successfully processed file for document chunking'
    );

    console.log(chalk.green(`File "${options.file}" processed successfully for collection "${options.collection}".`));
  } catch (error) {
    // Error already handled by executeCommand
  }
});

const searchCmd = docCommand
  .command('search')
  .description('Search for documents in a collection')
  .requiredOption('--instance <instanceId>', 'Instance ID')
  .requiredOption('--collection <collectionId>', 'Collection ID')
  .requiredOption('--query <query>', 'Search query')
  .option('--project <projectId>', 'Project ID or name (defaults to the current project)')
  .option('--filter <json>', 'Filter criteria as JSON string');

searchCmd.action(async (options) => {
  try {
    const project = await resolveProject(projectsApi, options);
    
    // Build the request body
    const requestBody = {
      query: options.query,
      params: {},
      filter: {},
      include: ["embedding"]
    };
    
    
    // Parse filter JSON if provided
    if (options.filter) {
      try {
        requestBody.filter = JSON.parse(options.filter);
      } catch (e: any) {
        console.error(chalk.red('Error parsing filter JSON:'), e.message);
        return;
      }
    }

    console.log("REQUEST BODY", requestBody);
    
    const results = await executeCommand(
      `Searching for documents in collection "${options.collection}" in instance ${options.instance}...`,
      async () => {
        const response = await documentsApi.documentControllerSimilaritySearch(
          project.id, 
          options.instance, 
          options.collection, 
          requestBody
        );
        return response.data;
      },
      'Successfully retrieved search results'
    );

    console.log(chalk.blue(`\nSearch results for query "${options.query}" in collection "${options.collection}":\n`));
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    // Error already handled by executeCommand
  }
});

}