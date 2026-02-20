import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import type { DocProcAgentResult } from './anthropic';

export type { DocProcAgentResult };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocProcOpenAIAgentOptions {
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
const DEFAULT_MAX_ITERATIONS = 8;

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
  const systemPrompt = readLocalFile('SYSTEM_PROMPT.md');
  const configGuide  = readLocalFile('CONFIG_GUIDE.md');
  const evalGuide    = readLocalFile('EVAL_GUIDE.md');

  return `${systemPrompt}\n\n---\n\n${configGuide}\n\n---\n\n${evalGuide}`;
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'write_and_validate_config',
      description:
        'Write the config.yaml content and validate it against the schema. Returns "VALID" on success or a list of validation errors to fix.',
      parameters: {
        type: 'object',
        properties: {
          yaml_content: {
            type: 'string',
            description: 'The complete YAML content for config.yaml',
          },
        },
        required: ['yaml_content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_and_validate_eval',
      description:
        'Write the eval.yaml content and validate it against the schema. Returns "VALID" on success or a list of validation errors to fix.',
      parameters: {
        type: 'object',
        properties: {
          yaml_content: {
            type: 'string',
            description: 'The complete YAML content for eval.yaml',
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
        'Signal that both files are complete and valid. Call this only after both write_and_validate_config and write_and_validate_eval have returned "VALID".',
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

export async function runDocProcAgentWithOpenAI(
  options: DocProcOpenAIAgentOptions,
): Promise<DocProcAgentResult> {
  const {
    instructions,
    openAiApiKey,
    model = DEFAULT_MODEL,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    onProgress = () => {},
  } = options;

  const configSchema = readLocalFile('config.schema.yaml');
  const evalSchema = readLocalFile('eval-test-cases.schema.yaml');

  const client = new OpenAI({ apiKey: openAiApiKey });

  let latestConfig = '';
  let latestEval = '';
  let configValid = false;
  let evalValid = false;
  let finished = false;
  let iteration = 0;

  function executeTool(name: string, input: Record<string, string>): string {
    if (name === 'write_and_validate_config') {
      const content = input.yaml_content ?? '';
      latestConfig = content;
      const result = validateYaml(content, configSchema);
      configValid = result.valid;
      if (result.valid) return 'VALID';
      return `VALIDATION ERRORS — fix all of these before calling again:\n${result.errors.map((e) => `  • ${e}`).join('\n')}`;
    }

    if (name === 'write_and_validate_eval') {
      const content = input.yaml_content ?? '';
      latestEval = content;
      const result = validateYaml(content, evalSchema);
      evalValid = result.valid;
      if (result.valid) return 'VALID';
      return `VALIDATION ERRORS — fix all of these before calling again:\n${result.errors.map((e) => `  • ${e}`).join('\n')}`;
    }

    if (name === 'finish') {
      if (!configValid || !evalValid) {
        return 'Cannot finish: not all files have passed validation yet. Call write_and_validate_config and write_and_validate_eval first and ensure both return "VALID".';
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
      content: `Here are the instructions for the pipeline you need to configure:\n\n${instructions}\n\nGenerate the config.yaml and eval.yaml files now. Use the tools to write and validate them.`,
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
    configYaml: latestConfig,
    evalYaml: latestEval,
    iterations: iteration,
    configValid,
    evalValid,
  };
}
