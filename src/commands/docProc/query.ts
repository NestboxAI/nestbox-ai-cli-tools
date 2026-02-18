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
  writeTemplateFile,
} from './helpers';

const QUERY_TEMPLATE = `queries:
  - id: payment_terms
    question: "What are the payment terms?"
    mode: local
`;

export function registerDocProcQueryCommands(docProcCommand: Command): void {
  const queryCommand = docProcCommand.command('query').description('Manage batch query YAML submissions');

  queryCommand
    .command('init')
    .description('Create a batch query YAML template')
    .option('-o, --output <path>', 'Output file path', './query.yaml')
    .option('-f, --force', 'Overwrite existing file')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        writeTemplateFile(options.output, QUERY_TEMPLATE, options.force);
        console.log(chalk.green(`Query template created: ${options.output}`));
      });
    });

  queryCommand
    .command('create')
    .description('Create a batch query from YAML file')
    .requiredOption('-f, --file <path>', 'YAML file path')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        ensureFileExists(options.file);
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const form = new FormData();
        form.append('file', fs.createReadStream(options.file));

        const response = await apis.documentProcessingApi.documentProcessingControllerCreateBatchQuery(
          context.projectId,
          context.instanceId,
          { data: form, headers: form.getHeaders() },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(chalk.green('Batch query created successfully.'));
        console.log(JSON.stringify(data, null, 2));
      });
    });

  queryCommand
    .command('validate')
    .description('Validate query YAML without creating a query')
    .requiredOption('-f, --file <path>', 'YAML file path')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        ensureFileExists(options.file);
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const form = new FormData();
        form.append('file', fs.createReadStream(options.file));

        const response = await apis.documentProcessingApi.documentProcessingControllerValidateQueryYaml(
          context.projectId,
          context.instanceId,
          { data: form, headers: form.getHeaders() },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });

  queryCommand
    .command('list')
    .description('List batch queries')
    .option('--page <page>', 'Page number', '0')
    .option('--limit <limit>', 'Page size', '20')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerListQueries(
          context.projectId,
          context.instanceId,
          { params: { page: Number(options.page), limit: Number(options.limit) } },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;

        const queries = data?.data?.queries || data?.queries || [];
        if (!queries.length) {
          console.log(chalk.yellow('No queries found.'));
          return;
        }

        printSimpleTable(
          ['Query ID', 'Name', 'Created At'],
          queries.map((query: any) => [query.id || 'N/A', query.name || 'N/A', query.createdAt || 'N/A']),
        );
      });
    });

  queryCommand
    .command('show')
    .description('Get batch query details by ID')
    .requiredOption('--query <queryId>', 'Query ID')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerGetQuery(
          context.projectId,
          context.instanceId,
          options.query,
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });
}
