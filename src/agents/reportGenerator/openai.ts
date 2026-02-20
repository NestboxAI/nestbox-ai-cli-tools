import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import type { ReportComposerAgentResult } from './anthropic';

export type { ReportComposerAgentResult };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportComposerOpenAIAgentOptions {
  /** Full instruction text (from the instructions file) */
  instructions: string;
  /** OpenAI API key */
  openAiApiKey: string;
  /** OpenAI model ID, e.g. "gpt-4o" */
  model?: string;
  /** Maximum agentic iterations before giving up */
  maxIterations?: number;
  /** Called on each status update (for spinner / logging) */
  onProgress?: (message: string) => void;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENTS_DIR = __dirname;
export const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_MAX_ITERATIONS = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readLocalFile(filename: string): string {
  return fs.readFileSync(path.join(AGENTS_DIR, filename), 'utf8');
}

function validateYaml(content: string, schemaContent: string): ValidationResult {
  const preprocessed = content.replace(/\$\{[^}]+\}/g, 'env-var-placeholder');

  let data: unknown;
  try {
    data = yaml.load(preprocessed);
  } catch (e: any) {
    return { valid: false, errors: [`YAML parse error: ${e.message}`] };
  }

  let schema: object;
  try {
    schema = yaml.load(schemaContent) as object;
  } catch (e: any) {
    return { valid: false, errors: [`Schema parse error: ${e.message}`] };
  }

  const ajv = new Ajv({ strict: false, allErrors: true });
  ajv.addFormat('uri', () => true);
  const validate = ajv.compile(schema);
  const ok = validate(data);

  if (ok) return { valid: true, errors: [] };

  const errors = (validate.errors ?? []).map((err) => {
    const loc = err.instancePath || '(root)';
    return `[${loc}] ${err.message}`;
  });
  return { valid: false, errors };
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const systemPrompt  = readLocalFile('SYSTEM_PROMPT.md');
  const configGuide   = readLocalFile('REPORT_CONFIG_GUIDE.md');
  const example1      = readLocalFile('annual_report_10k.yaml');
  const example2      = readLocalFile('vc_portfolio_monitoring.yaml');

  return [
    systemPrompt,
    '---',
    configGuide,
    '---',
    '# Example 1: Annual Report / 10-K Analysis\n\n```yaml\n' + example1 + '\n```',
    '---',
    '# Example 2: VC Portfolio Monitoring\n\n```yaml\n' + example2 + '\n```',
  ].join('\n\n');
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'write_and_validate_report',
      description:
        'Write the report.yaml content and validate it against the schema. Returns "VALID" on success or a list of validation errors to fix.',
      parameters: {
        type: 'object',
        properties: {
          yaml_content: {
            type: 'string',
            description: 'The complete YAML content for report.yaml',
          },
        },
        required: ['yaml_content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description:
        'Signal that the report.yaml is complete and valid. Call this only after write_and_validate_report has returned "VALID".',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Brief summary of what was generated and why key choices were made',
          },
        },
        required: ['summary'],
      },
    },
  },
];

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runReportComposerAgentWithOpenAI(
  options: ReportComposerOpenAIAgentOptions,
): Promise<ReportComposerAgentResult> {
  const {
    instructions,
    openAiApiKey,
    model = DEFAULT_MODEL,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    onProgress = () => {},
  } = options;

  const reportSchema = readLocalFile('report_config.schema.yaml');

  const client = new OpenAI({ apiKey: openAiApiKey });

  let latestReport = '';
  let reportValid = false;
  let finished = false;
  let iteration = 0;

  function executeTool(name: string, input: Record<string, string>): string {
    if (name === 'write_and_validate_report') {
      const content = input.yaml_content ?? '';
      latestReport = content;
      const result = validateYaml(content, reportSchema);
      reportValid = result.valid;
      if (result.valid) return 'VALID';
      return `VALIDATION ERRORS — fix all of these before calling again:\n${result.errors.map((e) => `  • ${e}`).join('\n')}`;
    }

    if (name === 'finish') {
      if (!reportValid) {
        return 'Cannot finish: the report has not passed schema validation yet. Call write_and_validate_report first and ensure it returns "VALID".';
      }
      finished = true;
      return 'Done.';
    }

    return `Unknown tool: ${name}`;
  }

  const systemPromptText = buildSystemPrompt();
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPromptText },
    {
      role: 'user',
      content: `Here are the instructions for the report you need to configure:\n\n${instructions}\n\nGenerate the report.yaml file now. Use the tools to write and validate it.`,
    },
  ];

  onProgress('Starting agent...');

  while (iteration < maxIterations && !finished) {
    iteration++;
    onProgress(`Iteration ${iteration}/${maxIterations} — calling OpenAI...`);

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      // Force the model to call a tool every turn.
      tool_choice: 'required',
    });

    const message = response.choices[0].message;
    messages.push(message);

    if (response.choices[0].finish_reason !== 'tool_calls') {
      onProgress(`Agent stopped unexpectedly: ${response.choices[0].finish_reason}`);
      break;
    }

    const toolResultMessages: OpenAI.ChatCompletionMessageParam[] = [];

    for (const toolCall of message.tool_calls ?? []) {
      if (toolCall.type !== 'function') continue;
      onProgress(`  → tool: ${toolCall.function.name}`);
      const input = JSON.parse(toolCall.function.arguments) as Record<string, string>;
      const result = executeTool(toolCall.function.name, input);
      onProgress(`    ${result.startsWith('VALID') ? '✓ valid' : result.split('\n')[0]}`);

      toolResultMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });

      if (finished) break;
    }

    if (toolResultMessages.length > 0) {
      messages.push(...toolResultMessages);
    }

    if (finished) break;
  }

  if (iteration >= maxIterations && !finished) {
    onProgress(`Warning: reached max iterations (${maxIterations}) without finishing.`);
  }

  return {
    reportYaml: latestReport,
    iterations: iteration,
    reportValid,
  };
}
