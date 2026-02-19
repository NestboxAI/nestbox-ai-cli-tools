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
    .option('--model <model>', 'Claude model ID', 'claude-opus-4-6')
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

        // ── Write output files ───────────────────────────────────────────────
        if (result.configYaml) {
          fs.writeFileSync(configOut, result.configYaml, 'utf8');
        }
        if (result.evalYaml) {
          fs.writeFileSync(evalOut, result.evalYaml, 'utf8');
        }

        // ── Summary ──────────────────────────────────────────────────────────
        console.log(chalk.bold('Results'));
        console.log(
          `  config.yaml  ${result.configValid ? chalk.green('✓ valid') : chalk.yellow('⚠ not validated')}  →  ${configOut}`,
        );
        console.log(
          `  eval.yaml    ${result.evalValid   ? chalk.green('✓ valid') : chalk.yellow('⚠ not validated')}  →  ${evalOut}`,
        );
        console.log(chalk.dim(`\n  Completed in ${result.iterations} iteration(s).`));

        if (!result.configValid || !result.evalValid) {
          console.log(
            chalk.yellow('\nWarning: one or more files may have validation issues.') +
            chalk.dim(' Review the output files and fix manually if needed.'),
          );
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
