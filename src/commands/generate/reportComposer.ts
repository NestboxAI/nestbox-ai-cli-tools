import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import { runReportComposerAgent } from '../../agents/reportGenerator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportComposerGenerateOptions {
  file: string;
  output: string;
  anthropicApiKey: string;
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
    .requiredOption('--anthropicApiKey <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
    .option('--model <model>', 'Claude model ID', 'claude-sonnet-4-6')
    .option('--maxIterations <n>', 'Maximum agent iterations', '5')
    .action(async (options: ReportComposerGenerateOptions) => {
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

      const reportOut = path.join(outputDir, 'report.yaml');

      // ── Run agent ──────────────────────────────────────────────────────────
      console.log(chalk.bold('\nNestbox — Report Composer Generator'));
      console.log(chalk.dim(`Instructions: ${instructionsPath}`));
      console.log(chalk.dim(`Output:       ${outputDir}`));
      console.log(chalk.dim(`Model:        ${options.model}`));
      console.log();

      const spinner = ora('Initialising agent...').start();

      try {
        const result = await runReportComposerAgent({
          instructions,
          anthropicApiKey: apiKey,
          model: options.model,
          maxIterations: parseInt(options.maxIterations ?? '8', 10),
          onProgress: (msg) => {
            spinner.text = msg;
          },
        });

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
