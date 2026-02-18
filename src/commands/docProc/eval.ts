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

const EVAL_TEMPLATE = `testCases:
  - id: q1
    question: "What are the payment terms?"
    expectedAnswer: "Net 30"
`;

export function registerDocProcEvalCommands(docProcCommand: Command): void {
  const evalCommand = docProcCommand.command('eval').description('Manage document evaluations');

  evalCommand
    .command('init')
    .description('Create an eval YAML template')
    .option('-o, --output <path>', 'Output file path', './eval.yaml')
    .option('-f, --force', 'Overwrite existing file')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        writeTemplateFile(options.output, EVAL_TEMPLATE, options.force);
        console.log(chalk.green(`Eval template created: ${options.output}`));
      });
    });

  evalCommand
    .command('run')
    .description('Create evaluation from YAML file')
    .requiredOption('--document <documentId>', 'Document ID')
    .requiredOption('-f, --file <path>', 'Path to eval YAML file')
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
        form.append('documentId', options.document);

        const response = await apis.documentProcessingApi.documentProcessingControllerCreateEval(
          context.projectId,
          context.instanceId,
          { data: form, headers: form.getHeaders() },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(chalk.green('Evaluation created successfully.'));
        console.log(JSON.stringify(data, null, 2));
      });
    });

  evalCommand
    .command('validate')
    .description('Validate eval YAML for a document without creating evaluation')
    .requiredOption('--document <documentId>', 'Document ID')
    .requiredOption('-f, --file <path>', 'Path to eval YAML file')
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

        const response = await apis.documentProcessingApi.documentProcessingControllerValidateEvalYaml(
          context.projectId,
          context.instanceId,
          options.document,
          { data: form, headers: form.getHeaders() },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });

  evalCommand
    .command('list')
    .description('List evaluations for a document')
    .requiredOption('--document <documentId>', 'Document ID')
    .option('--page <page>', 'Page number', '1')
    .option('--limit <limit>', 'Page size', '20')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerListEvals(
          context.projectId,
          context.instanceId,
          options.document,
          { params: { page: Number(options.page), limit: Number(options.limit) } },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;

        const evals = data?.data || data || [];
        if (!evals.length) {
          console.log(chalk.yellow('No evaluations found.'));
          return;
        }

        printSimpleTable(
          ['Eval ID', 'Status', 'Created At'],
          evals.map((entry: any) => [entry.id || 'N/A', entry.status || 'N/A', entry.createdAt || 'N/A']),
        );
      });
    });

  evalCommand
    .command('show')
    .description('Get evaluation details by eval ID')
    .requiredOption('--document <documentId>', 'Document ID')
    .requiredOption('--eval <evalId>', 'Evaluation ID')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerGetEval(
          context.projectId,
          context.instanceId,
          options.document,
          options.eval,
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });
}
