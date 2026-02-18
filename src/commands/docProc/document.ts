import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import FormData from 'form-data';
import { createDocProcApis } from './apiUtils';
import {
  ensureFileExists,
  getResponseData,
  maybePrintJson,
  printSimpleTable,
  resolveDocProcContext,
  withDocProcErrorHandling,
} from './helpers';

export function registerDocProcDocumentCommands(docProcCommand: Command): void {
  const documentCommand = docProcCommand.command('document').description('Create and inspect document-processing documents');

  documentCommand
    .command('create')
    .description('Create a document processing job by uploading a file')
    .requiredOption('--input <path>', 'Document file path')
    .option('--profile <profileId>', 'Processing profile ID')
    .option('--stages <stages>', 'Comma-separated stage override')
    .option('--priority <priority>', 'Job priority: low|normal|high')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        ensureFileExists(options.input);
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const form = new FormData();
        form.append('file', fs.createReadStream(options.input));
        if (options.profile) form.append('profileId', options.profile);
        if (options.stages) form.append('stages', options.stages);
        if (options.priority) form.append('priority', options.priority);

        const response = await apis.documentProcessingApi.documentProcessingControllerCreateDocumentProcessingJob(
          context.projectId,
          context.instanceId,
          { data: form, headers: form.getHeaders() },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(chalk.green('Document processing job created successfully.'));
        console.log(JSON.stringify(data, null, 2));
      });
    });

  documentCommand
    .command('list')
    .description('List processed documents')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--page <page>', 'Page number', '1')
    .option('--limit <limit>', 'Page size', '20')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);
        const response = await apis.documentProcessingApi.documentProcessingControllerListDocuments(
          context.projectId,
          context.instanceId,
          { params: { page: Number(options.page), limit: Number(options.limit) } },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;

        const documents = data?.data || data || [];
        if (!documents.length) {
          console.log(chalk.yellow('No documents found.'));
          return;
        }

        printSimpleTable(
          ['Document ID', 'Name', 'Status', 'Created At'],
          documents.map((doc: any) => [doc.id || 'N/A', doc.name || doc.fileName || 'N/A', doc.status || 'N/A', doc.createdAt || 'N/A']),
        );
      });
    });

  documentCommand
    .command('show')
    .description('Show processed document details')
    .requiredOption('--document <documentId>', 'Document ID')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerGetDocument(
          context.projectId,
          context.instanceId,
          options.document,
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });

  documentCommand
    .command('artifacts')
    .description('Download document artifacts as zip')
    .requiredOption('--document <documentId>', 'Document ID')
    .option('-o, --output <path>', 'Output zip path', './document-artifacts.zip')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerDownloadDocumentArtifacts(
          context.projectId,
          context.instanceId,
          options.document,
          { responseType: 'arraybuffer' },
        );

        fs.writeFileSync(options.output, Buffer.from(response.data as any));
        console.log(chalk.green(`Artifacts downloaded: ${options.output}`));
      });
    });
}
