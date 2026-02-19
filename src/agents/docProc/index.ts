import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocProcAgentOptions {
  /** Full instruction text (from the instructions file) */
  instructions: string;
  /** Anthropic API key */
  anthropicApiKey: string;
  /** Claude model ID, e.g. "claude-opus-4-6" */
  model?: string;
  /** Maximum agentic iterations before giving up */
  maxIterations?: number;
  /** Called on each status update (for spinner / logging) */
  onProgress?: (message: string) => void;
}

export interface DocProcAgentResult {
  configYaml: string;
  evalYaml: string;
  iterations: number;
  configValid: boolean;
  evalValid: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENTS_DIR = __dirname;
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_ITERATIONS = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readLocalFile(filename: string): string {
  return fs.readFileSync(path.join(AGENTS_DIR, filename), 'utf8');
}

function validateYaml(content: string, schemaContent: string): ValidationResult {
  // Replace ${ENV_VAR} references with a plain string so YAML parses cleanly
  // and AJV treats them as valid string values.
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
  const systemPrompt = readLocalFile('SYSTEM_PROMPT.md');
  const configGuide  = readLocalFile('CONFIG_GUIDE.md');
  const evalGuide    = readLocalFile('EVAL_GUIDE.md');

  return `${systemPrompt}\n\n---\n\n${configGuide}\n\n---\n\n${evalGuide}`;
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'write_and_validate_config',
    description:
      'Write the config.yaml content and validate it against the schema. Returns "VALID" on success or a list of validation errors to fix.',
    input_schema: {
      type: 'object' as const,
      properties: {
        yaml_content: {
          type: 'string',
          description: 'The complete YAML content for config.yaml',
        },
      },
      required: ['yaml_content'],
    },
  },
  {
    name: 'write_and_validate_eval',
    description:
      'Write the eval.yaml content and validate it against the schema. Returns "VALID" on success or a list of validation errors to fix.',
    input_schema: {
      type: 'object' as const,
      properties: {
        yaml_content: {
          type: 'string',
          description: 'The complete YAML content for eval.yaml',
        },
      },
      required: ['yaml_content'],
    },
  },
  {
    name: 'finish',
    description:
      'Signal that both files are complete and valid. Call this only after both write_and_validate_config and write_and_validate_eval have returned "VALID".',
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

export async function runDocProcAgent(options: DocProcAgentOptions): Promise<DocProcAgentResult> {
  const {
    instructions,
    anthropicApiKey,
    model = DEFAULT_MODEL,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    onProgress = () => {},
  } = options;

  const configSchema = readLocalFile('config.schema.yaml');
  const evalSchema = readLocalFile('eval-test-cases.schema.yaml');

  const client = new Anthropic({ apiKey: anthropicApiKey });

  // Mutable state updated by tool calls
  let latestConfig = '';
  let latestEval = '';
  let configValid = false;
  let evalValid = false;
  let finished = false;
  let iteration = 0;

  // Execute a tool call and return the result string
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
      finished = true;
      return 'Done.';
    }

    return `Unknown tool: ${name}`;
  }

  // Build the system prompt once and mark it for caching.
  // On iteration 1 the prompt is written to the cache (normal price).
  // On iterations 2+ the 20k-token system prompt is read from cache at
  // 10% of the normal input token price — the biggest cost lever here.
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
      content: `Here are the instructions for the pipeline you need to configure:\n\n${instructions}\n\nGenerate the config.yaml and eval.yaml files now. Use the tools to write and validate them.`,
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
    configYaml: latestConfig,
    evalYaml: latestEval,
    iterations: iteration,
    configValid,
    evalValid,
  };
}
