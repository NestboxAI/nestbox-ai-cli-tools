import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import {
  createNestboxConfig,
  extractZip,
} from "../../utils/agent";
import inquirer from "inquirer";
import path from "path";

export function registerGenerateCommand(agentCommand: Command): void {
  agentCommand
    .command("generate <folder>")
    .description("Generate a new project from templates")
    .option("--lang <language>", "Project language (ts|js)")
    .option("--template <type>", "Template type (agent|chatbot)")
    .option("--project <projectId>", "Project ID")
    .action(async (folder, options) => {
      try {
        const spinner = ora("Initializing project generation...").start();

        // Ensure target folder doesn't exist
        if (fs.existsSync(folder)) {
          spinner.fail(`Folder ${folder} already exists`);
          return;
        }

        let selectedLang = options.lang;
        let selectedTemplate = options.template;

        // Interactive selection if not provided
        if (!selectedLang || !selectedTemplate) {
          spinner.stop();
          
          const answers = await inquirer.prompt([
            {
              type: 'list',
              name: 'lang',
              message: 'Select project language:',
              choices: [
                { name: 'TypeScript', value: 'ts' },
                { name: 'JavaScript', value: 'js' }
              ],
              when: () => !selectedLang
            },
            {
              type: 'list',
              name: 'template',
              message: 'Select template type:',
              choices: [
                { name: 'Agent', value: 'agent' },
                { name: 'Chatbot', value: 'chatbot' }
              ],
              when: () => !selectedTemplate
            }
          ]);

          selectedLang = selectedLang || answers.lang;
          selectedTemplate = selectedTemplate || answers.template;
          
          spinner.start("Generating project...");
        }

        // Find matching template in local templates folder
        const templateMapping: Record<string, string> = {
          'agent': 'base',
          'chatbot': 'chatbot'
        };
        const mappedTemplateType = templateMapping[selectedTemplate] || selectedTemplate;
        const templateKey = `template-${mappedTemplateType}-${selectedLang}.zip`;
        
        // Try process.cwd() first, then __dirname fallback
        let templatePath = path.resolve(process.cwd(), 'templates', templateKey);
        if (!fs.existsSync(templatePath)) {
          // fallback to __dirname
          templatePath = path.resolve(__dirname, '../../../templates', templateKey);
        }
        
        if (!fs.existsSync(templatePath)) {
          spinner.fail(`Template not found: ${templatePath}`);
          // Show available templates in both locations
          const cwdTemplates = path.resolve(process.cwd(), 'templates');
          const dirTemplates = path.resolve(__dirname, '../../../templates');
          let shown = false;
          
          if (fs.existsSync(cwdTemplates)) {
            console.log(chalk.yellow('Available templates in ./templates:'));
            fs.readdirSync(cwdTemplates).forEach(file => {
              console.log(chalk.yellow(`  - ${file}`));
            });
            shown = true;
          }
          
          if (fs.existsSync(dirTemplates)) {
            console.log(chalk.yellow('Available templates in templates:'));
            fs.readdirSync(dirTemplates).forEach(file => {
              console.log(chalk.yellow(`  - ${file}`));
            });
            shown = true;
          }
          
          if (!shown) {
            console.log(chalk.red('No templates directory found. Please add your templates.'));
          }
          return;
        }

        spinner.text = `Extracting template to ${folder}...`;

        try {
          // Extract template to target folder
          extractZip(templatePath, folder);

          // Create nestbox.config.json for TypeScript projects
          createNestboxConfig(folder, selectedLang === 'ts');

          // Update package.json with project name if it exists
          const packageJsonPath = path.join(folder, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            packageJson.name = path.basename(folder);
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
          }

          spinner.succeed(`Successfully generated ${mappedTemplateType} project in ${folder}`);
          
          console.log(chalk.green("\nNext steps:"));
          console.log(chalk.yellow(`  cd ${folder}`));
          console.log(chalk.yellow("  npm install"));
          if (selectedLang === 'ts') {
            console.log(chalk.yellow("  npm run build"));
          }
          console.log(chalk.yellow("  nestbox agent deploy --agent <agent-name> --instance <instance-name>"));

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(folder)) {
            fs.rmSync(folder, { recursive: true, force: true });
          }
          throw error;
        }

      } catch (error: any) {
        console.error(
          chalk.red("Error:"),
          error.message || "Failed to generate project"
        );
      }
    });
}
