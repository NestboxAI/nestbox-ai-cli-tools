import { Command } from 'commander';
import { createDocProcApis } from './apiUtils';
import {
  getResponseData,
  maybePrintJson,
  resolveDocProcContext,
  withDocProcErrorHandling,
} from './helpers';

export function registerDocProcHealthCommand(docProcCommand: Command): void {
  docProcCommand
    .command('health')
    .description('Get document processing API client health')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: any) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerGetHealth(
          context.projectId,
          context.instanceId,
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });
}
