import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import { runReportComposerAgent } from '../../agents/reportGenerator/anthropic';
import { runReportComposerAgentWithOpenAI } from '../../agents/reportGenerator/openai';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportComposerGenerateOptions {
  file: string;
  output: string;
  anthropicApiKey?: string;
  openAiApiKey?: string;
  model?: string;
  maxIterations?: string;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export function registerReportComposerGenerateCommand(generateCommand: Command): void {
  generateCommand
    .command('report-composer')
    .description(
      'Generate a report composer report.yaml configuration from an instructions file using Claude AI',
    )
    .requiredOption('-f, --file <path>', 'Path to the instructions Markdown file')
    .requiredOption('-o, --output <dir>', 'Output directory for the generated report.yaml')
    .option('--anthropicApiKey <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
    .option('--openAiApiKey <key>', 'OpenAI API key (or set OPENAI_API_KEY env var)')
    .option('--model <model>', 'Model ID (defaults to claude-sonnet-4-6 for Anthropic, gpt-4o for OpenAI)')
    .option('--maxIterations <n>', 'Maximum agent iterations', '5')
    .action(async (options: ReportComposerGenerateOptions) => {
      // ── Resolve API keys ────────────────────────────────────────────────────
      const anthropicKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      const openAiKey = options.openAiApiKey || process.env.OPENAI_API_KEY;

      if (!anthropicKey && !openAiKey) {
        console.error(
          chalk.red(
            'Error: An API key is required. Provide --anthropicApiKey / ANTHROPIC_API_KEY or --openAiApiKey / OPENAI_API_KEY.',
          ),
        );
        process.exit(1);
      }

      // Anthropic takes precedence when both are available
      const useAnthropic = !!anthropicKey;
      const provider = useAnthropic ? 'Claude (Anthropic)' : 'GPT (OpenAI)';
      const defaultModel = useAnthropic ? 'claude-sonnet-4-6' : 'gpt-4o';
      const model = options.model ?? defaultModel;

      // ── Read instructions file ──────────────────────────────────────────────
      const instructionsPath = path.resolve(options.file);
      if (!fs.existsSync(instructionsPath)) {
        console.error(chalk.red(`Error: Instructions file not found: ${instructionsPath}`));
        process.exit(1);
      }
      const instructions = fs.readFileSync(instructionsPath, 'utf8');
      if (!instructions.trim()) {
        console.error(chalk.red('Error: Instructions file is empty.'));
        process.exit(1);
      }

      // ── Ensure output directory exists ─────────────────────────────────────
      const outputDir = path.resolve(options.output);
      fs.mkdirSync(outputDir, { recursive: true });

      const reportOut = path.join(outputDir, 'report.yaml');

      // ── Run agent ──────────────────────────────────────────────────────────
      console.log(chalk.bold('\nNestbox — Report Composer Generator'));
      console.log(chalk.dim(`Instructions: ${instructionsPath}`));
      console.log(chalk.dim(`Output:       ${outputDir}`));
      console.log(chalk.dim(`Provider:     ${provider}`));
      console.log(chalk.dim(`Model:        ${model}`));
      console.log();

      const spinner = ora('Initialising agent...').start();

      try {
        const agentOptions = {
          instructions,
          model,
          maxIterations: parseInt(options.maxIterations ?? '5', 10),
          onProgress: (msg: string) => {
            spinner.text = msg;
          },
        };

        const result = useAnthropic
          ? await runReportComposerAgent({ ...agentOptions, anthropicApiKey: anthropicKey! })
          : await runReportComposerAgentWithOpenAI({ ...agentOptions, openAiApiKey: openAiKey! });

        spinner.stop();

        // ── Write output file ────────────────────────────────────────────────
        const reportWritten = result.reportYaml.trim().length > 0;

        if (reportWritten) fs.writeFileSync(reportOut, result.reportYaml, 'utf8');

        // ── Summary ──────────────────────────────────────────────────────────
        console.log(chalk.bold('Results'));

        if (reportWritten) {
          const status = result.reportValid ? chalk.green('✓ valid') : chalk.yellow('⚠ invalid');
          console.log(`  report.yaml  ${status}  →  ${reportOut}`);
        } else {
          console.log(`  report.yaml  ${chalk.red('✗ not generated')}`);
        }

        console.log(chalk.dim(`\n  Completed in ${result.iterations} iteration(s).`));

        if (!reportWritten || !result.reportValid) {
          console.log(chalk.yellow('\nWarning: report.yaml was not generated or has validation issues.'));
          process.exit(1);
        }

        console.log(chalk.green('\nDone.'));
      } catch (err: any) {
        spinner.stop();
        console.error(chalk.red(`\nError: ${err?.message ?? err}`));
        process.exit(1);
      }
    });
}
