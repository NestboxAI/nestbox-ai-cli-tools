import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import { createNestboxConfig } from "../../utils/agent";
import {
	generateWithPlop,
	listAvailableTemplates,
} from "../../utils/plopGenerator";
import { isValidFunctionName } from "../../utils/validation";
import inquirer from "inquirer";
import path from "path";

export function registerProjectCommand(generateCommand: Command): void {
	generateCommand
		.command("project <folder>")
		.description("Generate a new project from templates")
		.option("--lang <language>", "Project language (ts|js)")
		.option("--template <type>", "Template type (agent|chatbot)")
		.option(
			"--name <agentName>",
			"Agent/Chatbot name (must be a valid function name)"
		)
		.option("--project <projectId>", "Project ID")
		.action(async (folder, options) => {
			try {
				const spinner = ora(
					"Initializing project generation..."
				).start();

				// Ensure target folder doesn't exist
				if (fs.existsSync(folder)) {
					spinner.fail(`Folder ${folder} already exists`);
					return;
				}

				let selectedLang = options.lang;
				let selectedTemplate = options.template;
				let agentName = options.name;

				// Interactive selection if not provided
				if (!selectedLang || !selectedTemplate) {
					spinner.stop();

					const answers = await inquirer.prompt([
						{
							type: "list",
							name: "lang",
							message: "Select project language:",
							choices: [
								{ name: "TypeScript", value: "ts" },
								{ name: "JavaScript", value: "js" },
								{ name: "Python", value: "py" },
							],
							when: () => !selectedLang,
						},
						{
							type: "list",
							name: "template",
							message: "Select template type:",
							choices: [
								{ name: "Agent", value: "agent" },
								{ name: "Chatbot", value: "chatbot" },
							],
							when: () => !selectedTemplate,
						},
						{
							type: "input",
							name: "agentName",
							message:
								"Enter agent/chatbot name (must be a valid function name):",
							when: () => !agentName,
							default: (answers: any) => {
								const type =
									selectedTemplate || answers.template;
								return type === "agent"
									? "myAgent"
									: "myChatbot";
							},
							validate: (input: string) => {
								if (!input.trim()) {
									return "Agent name cannot be empty";
								}
								if (!isValidFunctionName(input.trim())) {
									return "Must be a valid function name (e.g., myAgent, chatBot123, my_agent)";
								}
								return true;
							},
						},
					]);

					selectedLang = selectedLang || answers.lang;
					selectedTemplate = selectedTemplate || answers.template;
					agentName = agentName || answers.agentName;

					spinner.start("Generating project...");
				}

				// Validate agent name if provided via CLI option
				if (agentName && !isValidFunctionName(agentName)) {
					spinner.fail(
						`Invalid agent name: "${agentName}". Must be a valid function name (e.g., myAgent, chatBot123, my_agent)`
					);
					return;
				}

				// Set default agent name if not provided
				if (!agentName) {
					agentName =
						selectedTemplate === "agent" ? "myAgent" : "myChatbot";
				}

				// Find matching template in local templates folder
				const templateMapping: Record<string, string> = {
					agent: "base",
					chatbot: "chatbot",
				};
				const mappedTemplateType =
					templateMapping[selectedTemplate] || selectedTemplate;

				// Check if template directory exists
				console.log(__dirname);
				const templatePath = path.resolve(
					__dirname,
					`../../../templates/${mappedTemplateType}-${selectedLang}`
				);

				if (!fs.existsSync(templatePath)) {
					spinner.fail(`Template not found: ${templatePath}`);
					// Show available templates
					const availableTemplates = listAvailableTemplates();
					if (availableTemplates.length > 0) {
						console.log(chalk.yellow("Available templates:"));
						availableTemplates.forEach(template => {
							console.log(chalk.yellow(`  - ${template}`));
						});
					} else {
						console.log(
							chalk.red(
								"No templates found. Please add your templates to the templates directory."
							)
						);
					}
					return;
				}

				spinner.text = `Generating ${mappedTemplateType} project in ${folder}...`;

				try {
					// Generate project using plop
					const { agentNameInYaml } = await generateWithPlop(
						selectedTemplate,
						selectedLang,
						folder,
						path.basename(folder),
						agentName
					);

					// Create nestbox.config.json for TypeScript projects
					createNestboxConfig(folder, selectedLang === "ts");

					spinner.succeed(
						`Successfully generated ${mappedTemplateType} project in ${folder}`
					);

					console.log(chalk.green("\nNext steps:"));
					console.log(chalk.yellow(`  cd ${folder}`));
					if (selectedLang === "py") {
						console.log(
							chalk.yellow(
								"  pip install -r requirements.txt"
							)
						);
					} else {	
						console.log(chalk.yellow("  npm install"));
						if (selectedLang === "ts") {
							console.log(chalk.yellow("  npm run build"));
						}
					}
					console.log(
						chalk.yellow(
							`  nestbox agent deploy --agent ${agentNameInYaml} --instance <instance-name>`
						)
					);
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
