import { Command } from 'commander';
import chalk from 'chalk';
import { createDocProcApis } from './apiUtils';
import {
  getResponseData,
  maybePrintJson,
  printSimpleTable,
  resolveDocProcContext,
  withDocProcErrorHandling,
} from './helpers';

export function registerDocProcJobCommands(docProcCommand: Command): void {
  const jobCommand = docProcCommand.command('job').description('Monitor document-processing jobs');

  jobCommand
    .command('list')
    .description('List document-processing jobs')
    .option('--state <state>', 'Filter state')
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

        const response = await apis.documentProcessingApi.documentProcessingControllerListJobs(
          context.projectId,
          context.instanceId,
          {
            params: {
              page: Number(options.page),
              limit: Number(options.limit),
              state: options.state,
            },
          },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;

        const jobs = data?.data?.jobs || data?.jobs || [];
        if (!jobs.length) {
          console.log(chalk.yellow('No jobs found.'));
          return;
        }

        printSimpleTable(
          ['Job ID', 'State', 'Document ID', 'Created At'],
          jobs.map((job: any) => [job.id || 'N/A', job.state || job.status || 'N/A', job.documentId || 'N/A', job.createdAt || 'N/A']),
        );
      });
    });

  jobCommand
    .command('status')
    .description('Get job status by ID')
    .requiredOption('--job <jobId>', 'Job ID')
    .option('--full', 'Use full job endpoint instead of lightweight status')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = options.full
          ? await apis.documentProcessingApi.documentProcessingControllerGetJob(
              context.projectId,
              context.instanceId,
              options.job,
            )
          : await apis.documentProcessingApi.documentProcessingControllerGetJobStatus(
              context.projectId,
              context.instanceId,
              options.job,
            );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });
}
