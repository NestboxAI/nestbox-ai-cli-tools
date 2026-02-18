import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import FormData from 'form-data';
import {
  createDocProcApis,
} from './apiUtils';
import {
  ensureFileExists,
  getResponseData,
  maybePrintJson,
  printSimpleTable,
  resolveDocProcContext,
  withDocProcErrorHandling,
  writeTemplateFile,
} from './helpers';

const PROFILE_TEMPLATE = `name: "My Document Pipeline"
description: "Optional description"

docling:
  ocr:
    enabled: true
    engine: rapidocr

chunking:
  strategy: docling_hybrid
  maxTokens: 1200
  overlapTokens: 200

graphrag:
  enabled: true
`;

export function registerDocProcProfileCommands(docProcCommand: Command): void {
  const profileCommand = docProcCommand.command('profile').description('Manage document-processing profiles');

  profileCommand
    .command('init')
    .description('Create a profile YAML template')
    .option('-o, --output <path>', 'Output file path', './profile.yaml')
    .option('-f, --force', 'Overwrite existing file')
    .action((options: { output: string; force?: boolean }) => {
      withDocProcErrorHandling(async () => {
        writeTemplateFile(options.output, PROFILE_TEMPLATE, options.force);
        console.log(chalk.green(`Profile template created: ${options.output}`));
      });
    });

  profileCommand
    .command('create')
    .description('Create/register a processing profile from YAML file')
    .requiredOption('-f, --file <path>', 'Path to profile YAML file')
    .option('-n, --name <name>', 'Override profile name')
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
        if (options.name) form.append('name', options.name);

        const response = await apis.documentProcessingApi.documentProcessingControllerCreateProfile(
          context.projectId,
          context.instanceId,
          { data: form, headers: form.getHeaders() },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(chalk.green('Profile created successfully.'));
        console.log(JSON.stringify(data, null, 2));
      });
    });

  profileCommand
    .command('validate')
    .description('Validate a profile YAML file against profile schema')
    .requiredOption('-f, --file <path>', 'Path to profile YAML file')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: { project?: string; instance?: string; file: string; json?: boolean }) => {
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
        console.log(chalk.green('Validation response:'));
        console.log(JSON.stringify(data, null, 2));
      });
    });

  profileCommand
    .command('list')
    .description('List processing profiles')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--page <page>', 'Page number', '0')
    .option('--limit <limit>', 'Page size', '20')
    .option('--json', 'Output JSON')
    .action((options: { project?: string; instance?: string; page: string; limit: string; json?: boolean }) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerListProfiles(
          context.projectId,
          context.instanceId,
          { params: { page: Number(options.page), limit: Number(options.limit) } },
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;

        const profiles = data?.data?.profiles || data?.profiles || [];
        if (!profiles.length) {
          console.log(chalk.yellow('No profiles found.'));
          return;
        }

        printSimpleTable(
          ['Profile ID', 'Name', 'Created At'],
          profiles.map((profile: any) => [profile.id || 'N/A', profile.name || 'N/A', profile.createdAt || 'N/A']),
        );
      });
    });

  profileCommand
    .command('show')
    .description('Show a processing profile by ID')
    .requiredOption('--profile <profileId>', 'Profile ID')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: { project?: string; instance?: string; profile: string; json?: boolean }) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerGetProfile(
          context.projectId,
          context.instanceId,
          options.profile,
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });

  profileCommand
    .command('schema')
    .description('Get profile schema for YAML configuration')
    .option('--project <projectId>', 'Project ID or name (defaults to current project)')
    .option('--instance <instanceId>', 'Document processing instance ID')
    .option('--json', 'Output JSON')
    .action((options: { project?: string; instance?: string; json?: boolean }) => {
      withDocProcErrorHandling(async () => {
        const apis = createDocProcApis();
        if (!apis) return;
        const context = await resolveDocProcContext(apis, options);

        const response = await apis.documentProcessingApi.documentProcessingControllerGetProfileSchema(
          context.projectId,
          context.instanceId,
        );

        const data = getResponseData(response);
        if (maybePrintJson(data, options.json)) return;
        console.log(JSON.stringify(data, null, 2));
      });
    });
}
