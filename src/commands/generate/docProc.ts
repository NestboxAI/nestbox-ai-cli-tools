import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import { runDocProcAgent } from '../../agents/docProc';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocProcGenerateOptions {
  file: string;
  output: string;
  anthropicApiKey: string;
  model?: string;
  maxIterations?: string;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export function registerDocProcGenerateCommand(generateCommand: Command): void {
  generateCommand
    .command('doc-proc')
    .description(
      'Generate a document pipeline config.yaml and eval.yaml from an instructions file using Claude AI',
    )
    .requiredOption('-f, --file <path>', 'Path to the instructions Markdown file')
    .requiredOption('-o, --output <dir>', 'Output directory for the generated files')
    .requiredOption('--anthropicApiKey <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
    .option('--model <model>', 'Claude model ID', 'claude-sonnet-4-6')
    .option('--maxIterations <n>', 'Maximum agent iterations', '8')
    .action(async (options: DocProcGenerateOptions) => {
      // ── Resolve API key (flag takes priority over env var) ─────────────────
      const apiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error(
          chalk.red('Error: Anthropic API key required. Use --anthropicApiKey or set ANTHROPIC_API_KEY.'),
        );
        process.exit(1);
      }

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

      const configOut = path.join(outputDir, 'config.yaml');
      const evalOut   = path.join(outputDir, 'eval.yaml');

      // ── Run agent ──────────────────────────────────────────────────────────
      console.log(chalk.bold('\nNestbox — Document Pipeline Generator'));
      console.log(chalk.dim(`Instructions: ${instructionsPath}`));
      console.log(chalk.dim(`Output:       ${outputDir}`));
      console.log(chalk.dim(`Model:        ${options.model}`));
      console.log();

      const spinner = ora('Initialising agent...').start();

      try {
        const result = await runDocProcAgent({
          instructions,
          anthropicApiKey: apiKey,
          model: options.model,
          maxIterations: parseInt(options.maxIterations ?? '8', 10),
          onProgress: (msg) => {
            spinner.text = msg;
          },
        });

        spinner.stop();

        // ── Write output files (always write whatever was produced) ──────────
        const configWritten = result.configYaml.trim().length > 0;
        const evalWritten   = result.evalYaml.trim().length > 0;

        if (configWritten) fs.writeFileSync(configOut, result.configYaml, 'utf8');
        if (evalWritten)   fs.writeFileSync(evalOut,   result.evalYaml,   'utf8');

        // ── Summary ──────────────────────────────────────────────────────────
        console.log(chalk.bold('Results'));

        if (configWritten) {
          const status = result.configValid ? chalk.green('✓ valid') : chalk.yellow('⚠ invalid');
          console.log(`  config.yaml  ${status}  →  ${configOut}`);
        } else {
          console.log(`  config.yaml  ${chalk.red('✗ not generated')}`);
        }

        if (evalWritten) {
          const status = result.evalValid ? chalk.green('✓ valid') : chalk.yellow('⚠ invalid');
          console.log(`  eval.yaml    ${status}  →  ${evalOut}`);
        } else {
          console.log(`  eval.yaml    ${chalk.red('✗ not generated')}`);
        }

        console.log(chalk.dim(`\n  Completed in ${result.iterations} iteration(s).`));

        const allDone = configWritten && evalWritten && result.configValid && result.evalValid;
        if (!allDone) {
          console.log(chalk.yellow('\nWarning: one or more files were not generated or have validation issues.'));
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
