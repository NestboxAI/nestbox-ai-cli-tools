import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportComposerAgentOptions {
  /** Full instruction text (from the instructions file) */
  instructions: string;
  /** Anthropic API key */
  anthropicApiKey: string;
  /** Claude model ID, e.g. "claude-sonnet-4-6" */
  model?: string;
  /** Maximum agentic iterations before giving up */
  maxIterations?: number;
  /** Called on each status update (for spinner / logging) */
  onProgress?: (message: string) => void;
}

export interface ReportComposerAgentResult {
  reportYaml: string;
  iterations: number;
  reportValid: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENTS_DIR = __dirname;
export const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_ITERATIONS = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readLocalFile(filename: string): string {
  return fs.readFileSync(path.join(AGENTS_DIR, filename), 'utf8');
}

function validateYaml(content: string, schemaContent: string): ValidationResult {
  // Replace ${ENV_VAR} and ${ENV_VAR:-default} references with a plain string
  // so YAML parses cleanly and AJV treats them as valid string values.
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
  // Suppress "unknown format 'uri' ignored" console warnings from AJV
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

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'write_and_validate_report',
    description:
      'Write the report.yaml content and validate it against the schema. Returns "VALID" on success or a list of validation errors to fix.',
    input_schema: {
      type: 'object' as const,
      properties: {
        yaml_content: {
          type: 'string',
          description: 'The complete YAML content for report.yaml',
        },
      },
      required: ['yaml_content'],
    },
  },
  {
    name: 'finish',
    description:
      'Signal that the report.yaml is complete and valid. Call this only after write_and_validate_report has returned "VALID".',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string',
          description: 'Brief summary of what was generated and why key choices were made',
        },
      },
      required: ['summary'],
    },
  },
];

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runReportComposerAgent(
  options: ReportComposerAgentOptions,
): Promise<ReportComposerAgentResult> {
  const {
    instructions,
    anthropicApiKey,
    model = DEFAULT_MODEL,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    onProgress = () => {},
  } = options;

  const reportSchema = readLocalFile('report_config.schema.yaml');

  const client = new Anthropic({ apiKey: anthropicApiKey });

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

  // Build the system prompt once and mark it for caching.
  // On iteration 1 the prompt is written to the cache (normal price).
  // On iterations 2+ the large system prompt is read from cache at
  // 10% of the normal input token price.
  const systemPromptText = buildSystemPrompt();
  const systemPrompt: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: systemPromptText,
      cache_control: { type: 'ephemeral' },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Here are the instructions for the report you need to configure:\n\n${instructions}\n\nGenerate the report.yaml file now. Use the tools to write and validate it.`,
    },
  ];

  onProgress('Starting agent...');

  while (iteration < maxIterations && !finished) {
    iteration++;
    onProgress(`Iteration ${iteration}/${maxIterations} — calling Claude...`);

    const response = await client.messages.create({
      model,
      max_tokens: 8096,
      system: systemPrompt,
      tools: TOOLS,
      // Force Claude to call a tool every turn — prevents it from
      // replying with plain text and exiting the loop prematurely.
      tool_choice: { type: 'any' },
      messages,
    });

    // Append assistant turn
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      onProgress(`Agent stopped unexpectedly: ${response.stop_reason}`);
      break;
    }

    // Process all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      onProgress(`  → tool: ${block.name}`);
      const result = executeTool(block.name, block.input as Record<string, string>);
      onProgress(`    ${result.startsWith('VALID') ? '✓ valid' : result.split('\n')[0]}`);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      });

      if (finished) break;
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
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
