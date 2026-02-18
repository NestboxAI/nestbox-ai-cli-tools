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

export function registerDocProcWebhookCommands(docProcCommand: Command): void {
  const webhookCommand = docProcCommand.command('webhook').description('Manage document-processing webhooks');

  webhookCommand
    .command('create')
    .description('Create webhook for receiving notifications')
    .requiredOption('--url <url>', 'Webhook URL')
    .option('--secret <secret>', 'Signing secret')
    .option('--event <event...>', 'Event name(s)')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerCreateWebhook(
          context.projectId,
          context.instanceId,
          {
            data: {
              url: options.url,
              secret: options.secret,
              events: options.event,
            },
          },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(chalk.green('Webhook created successfully.'));
        console.log(JSON.stringify(data, null, 2));
      });
    });

  webhookCommand
    .command('list')
    .description('List webhooks')
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

        const response = await apis.documentProcessingApi.documentProcessingControllerListWebhooks(
          context.projectId,
          context.instanceId,
          { params: { page: Number(options.page), limit: Number(options.limit) } },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;

        const webhooks = data?.data || data || [];
        if (!webhooks.length) {
          console.log(chalk.yellow('No webhooks found.'));
          return;
        }

        printSimpleTable(
          ['Webhook ID', 'URL', 'Created At'],
          webhooks.map((webhook: any) => [webhook.id || 'N/A', webhook.url || 'N/A', webhook.createdAt || 'N/A']),
        );
      });
    });

  webhookCommand
    .command('show')
    .description('Get webhook details by ID')
    .requiredOption('--webhook <webhookId>', 'Webhook ID')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerGetWebhook(
          context.projectId,
          context.instanceId,
          options.webhook,
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });

  webhookCommand
    .command('update')
    .description('Update webhook configuration')
    .requiredOption('--webhook <webhookId>', 'Webhook ID')
    .option('--url <url>', 'Webhook URL')
    .option('--secret <secret>', 'Signing secret')
    .option('--event <event...>', 'Event name(s)')
    .option('--active <active>', 'Set webhook active state (true|false)')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerUpdateWebhook(
          context.projectId,
          context.instanceId,
          options.webhook,
          {
            data: {
              url: options.url,
              secret: options.secret,
              events: options.event,
              active: options.active === undefined ? undefined : options.active === 'true',
            },
          },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(chalk.green('Webhook updated successfully.'));
        console.log(JSON.stringify(data, null, 2));
      });
    });

  webhookCommand
    .command('delete')
    .description('Delete a webhook')
    .requiredOption('--webhook <webhookId>', 'Webhook ID')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        await apis.documentProcessingApi.documentProcessingControllerDeleteWebhook(
          context.projectId,
          context.instanceId,
          options.webhook,
        );

        console.log(chalk.green('Webhook deleted successfully.'));
      });
    });
}
