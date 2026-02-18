import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import { resolveProject } from '../../utils/project';
import { DocProcApiInstances } from './apiUtils';

export interface CommonDocProcOptions {
  project?: string;
  instance?: string;
  json?: boolean;
  [key: string]: unknown;
}

export interface ResolvedDocProcContext {
  projectId: string;
  projectName: string;
  instanceId: string;
}

export async function resolveDocProcContext(
  apis: DocProcApiInstances,
  options: CommonDocProcOptions,
): Promise<ResolvedDocProcContext> {
  const project = await resolveProject(apis.projectsApi, { ...options, showSpinner: false, instance: 'doc-proc' });
  const instanceId = String(options.instance || process.env.NESTBOX_DOC_PROC_INSTANCE || '').trim();

  if (!instanceId) {
    throw new Error('Missing instance ID. Pass --instance <instanceId> or set NESTBOX_DOC_PROC_INSTANCE.');
  }

  return {
    projectId: project.id,
    projectName: project.name,
    instanceId,
  };
}

export function maybePrintJson(data: unknown, json?: boolean): boolean {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return true;
  }
  return false;
}

export function getResponseData(response: unknown): any {
  return (response as any)?.data;
}

export function printSimpleTable(headers: string[], rows: Array<Array<string | number | boolean>>): void {
  const table = new Table({
    head: headers.map((header) => chalk.white.bold(header)),
    style: { head: [], border: [] },
    wordWrap: true,
  });

  rows.forEach((row) => table.push(row));
  console.log(table.toString());
}

export function ensureFileExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

export function writeTemplateFile(outputPath: string, contents: string, force?: boolean): void {
  const resolved = path.resolve(outputPath);

  if (fs.existsSync(resolved) && !force) {
    throw new Error(`File already exists: ${resolved}. Use --force to overwrite.`);
  }

  fs.writeFileSync(resolved, contents, 'utf8');
}

export async function withDocProcErrorHandling(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error(chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".'));
      return;
    }

    const message = error.response?.data?.message || error.message || 'Unknown error';
    console.error(chalk.red('Error:'), message);
  }
}
