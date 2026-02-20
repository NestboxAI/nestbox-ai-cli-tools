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
    .option('--tags <tags>', 'Comma-separated list of tags (e.g. "invoice,2024,finance")')
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
        if (options.tags) {
          const tagList = options.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          tagList.forEach((tag: string) => form.append('tags', tag));
        }

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
    .option('--profile <profileId>', 'Filter by profile ID')
    .option('--tags <tags>', 'Filter by comma-separated tags (e.g. "invoice,2024")')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const params: Record<string, string | number> = { page: Number(options.page), limit: Number(options.limit) };
        if (options.profile) params.profileId = options.profile;
        if (options.tags) params.tags = options.tags;

        const response = await apis.documentProcessingApi.documentProcessingControllerListDocuments(
          context.projectId,
          context.instanceId,
          { params },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;

        const documents = data?.data || data || [];
        if (!documents.length) {
          console.log(chalk.yellow('No documents found.'));
          return;
        }

        printSimpleTable(
          ['Document ID', 'Name', 'Tags', 'Profile ID', 'Processed At'],
          documents.map((doc: any) => [
            doc.documentId || doc.id || 'N/A',
            doc.fileName || doc.name || 'N/A',
            Array.isArray(doc.tags) && doc.tags.length ? doc.tags.join(', ') : '—',
            doc.profileId || 'N/A',
            doc.processedAt || doc.createdAt || 'N/A',
          ]),
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
