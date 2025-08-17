import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import fs from "fs";
import yaml from 'js-yaml';
import { AgentYamlConfig } from "../../types/agentYaml";
import { userData } from "../../utils/user";
import { createAgent } from "./create";
import { createApis } from "./apiUtils";

export function registerCreateFromYamlCommand(agentCommand: Command): void {
  agentCommand
    .command("create [firstArg] [secondArg]")
    .description("Create multiple agents from a YAML configuration file")
    .option("--project <projectId>", "Project ID (defaults to the current project)")
    .action(async (firstArg: string, secondArg: any, options: any) => {
      try {
        let apis = createApis();

        // Determine which argument is the YAML file path
        let yamlFilePath: string;
        
        if (firstArg === 'file' && secondArg) {
          yamlFilePath = secondArg;
        } else if (firstArg) {
          yamlFilePath = firstArg;
          if (typeof secondArg === 'object' && !options) {
            options = secondArg;
          }
        } else {
          console.error(chalk.red("Missing YAML file path. Usage: nestbox agent create <yamlFile> OR nestbox agent create file <yamlFile>"));
          return;
        }

        // Check if file exists
        if (!fs.existsSync(yamlFilePath)) {
          console.error(chalk.red(`YAML file not found: ${yamlFilePath}`));
          return;
        }

        // Read and parse the YAML file
        const spinner = ora(`Reading agents configuration from ${yamlFilePath}...`).start();
        
        try {
          const fileContents = fs.readFileSync(yamlFilePath, 'utf8');
          const config = yaml.load(fileContents) as AgentYamlConfig;
          
          if (!config || !config.agents || !Array.isArray(config.agents)) {
            spinner.fail("Invalid YAML configuration: Missing 'agents' array");
            console.error(chalk.red("The YAML file should contain an 'agents' array with agent configurations"));
            return;
          }
          
          spinner.succeed(`Found ${config.agents.length} agents in configuration file`);
          
          // Process each agent with token refresh support
          const results = {
            success: 0,
            failed: 0,
            agents: [] as Array<{name: string; success: boolean; message: string}>
          };
          
          // Get user data once
          const user = await userData();
          
          for (const agent of config.agents) {
            if (!agent.name) {
              console.log(chalk.yellow("Skipping agent with no name defined"));
              results.failed++;
              results.agents.push({
                name: "unnamed",
                success: false,
                message: "Name is required"
              });
              continue;
            }
            
            let agentType = agent.type || "CHAT";
            const resourceType = agentType === "AGENT" ? "Agent" : "Chatbot";
            
            const agentSpinner = ora(`Creating ${resourceType.toLowerCase()} '${agent.name}'...`).start();
            
            try {
              // Create agent with token refresh support
              await withTokenRefresh(
                async () => {
                  // Map YAML config to createAgent options
                  const createOptions = {
                    ...options,
                    goal: agent.goal || "No goal specified",
                    modelBaseId: agent.modelBaseId || "",
                    instanceIP: agent.instanceIP || "localhost",
                    machineInstanceId: agent.machineInstanceId || 1,
                    machineManifestId: agent.machineManifestId || "default",
                    machineName: agent.machineName || `agent-${agent.name.toLowerCase()}`,
                    type: agentType,
                    userId: user.id,
                    parameters: agent.parameters ? agent.parameters.map((p: any) => {
                      return {
                        name: p.name || "unnamed",
                        description: p.description || "",
                        default: p.default || "",
                        isUserParam: p.isUserParam !== undefined ? p.isUserParam : true
                      };
                    }) : []
                  };
                  
                  await createAgent(agent.name, createOptions, apis.agentsApi, apis.projectsApi);
                },
                () => {
                  apis = createApis();
                }
              );
              
              agentSpinner.stop();
              
              results.success++;
              results.agents.push({
                name: agent.name,
                success: true,
                message: `Created successfully`
              });
            } catch (error: any) {
              agentSpinner.fail(`Failed to create ${resourceType.toLowerCase()} '${agent.name}'`);
              console.error(chalk.red(`Error: ${error.message}`));
              results.failed++;
              results.agents.push({
                name: agent.name,
                success: false,
                message: error.message
              });
            }
          }
          
          // Final summary
          console.log(chalk.blue("\nResource creation summary:"));
          const table = new Table({
            head: [
              chalk.white.bold("Name"),
              chalk.white.bold("Type"),
              chalk.white.bold("Status"),
              chalk.white.bold("Message"),
            ],
            style: {
              head: [],
              border: [],
            },
          });
          
          results.agents.forEach((agent, index) => {
            const agentConfig = config.agents.find(a => a.name === agent.name) || config.agents[index];
            const agentType = agentConfig?.type || "CHAT";
            const resourceType = agentType === "AGENT" ? "Agent" : "Chatbot";
            
            table.push([
              agent.name,
              resourceType,
              agent.success ? chalk.green("Success") : chalk.red("Failed"),
              agent.message
            ]);
          });
          
          console.log(table.toString());
          console.log(`\nTotal: ${results.success + results.failed}, Successful: ${results.success}, Failed: ${results.failed}`);
          
        } catch (error: any) {
          spinner.fail("Failed to process YAML file");
          if (error.code === 'ENOENT') {
            console.error(chalk.red(`File not found: ${yamlFilePath}`));
          } else if (error.name === 'YAMLException') {
            console.error(chalk.red(`Invalid YAML format: ${error.message}`));
          } else {
            console.error(
              chalk.red("Error:"),
              error.message || "Unknown error"
            );
          }
        }
      } catch (error: any) {
        if (error.message && error.message.includes('Authentication')) {
          console.error(chalk.red(error.message));
        } else {
          console.error(
            chalk.red("Error:"),
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }
    });
}
