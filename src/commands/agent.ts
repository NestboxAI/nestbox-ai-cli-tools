import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getAuthToken } from "../utils/auth";
import { Configuration, MachineAgentApi, ProjectsApi } from "@nestbox-ai/admin";
import { resolveProject } from "../utils/project";
import fs from "fs";
import {
  createZipFromDirectory,
  findProjectRoot,
  isTypeScriptProject,
  loadNestboxConfig,
  runPredeployScripts,
} from "../utils/agent";
import axios from "axios";
import { AgentType } from "../types/agentType";

export function registerAgentCommands(program: Command): void {
  // Get authentication token and create API configuration
  const authToken = getAuthToken();
  const configuration = new Configuration({
    basePath: authToken?.serverUrl,
    baseOptions: {
      headers: {
        Authorization: authToken?.token,
      },
    },
  });

  const agentsApi = new MachineAgentApi(configuration);
  const projectsApi = new ProjectsApi(configuration);

  // Create the main agent command
  const agentCommand = program
    .command("agent")
    .description("Manage Nestbox agents");

  // Add the list subcommand
  agentCommand
    .command("list")
    .description("List all AI agents associated with the authenticated user")
    .option(
      "--project <projectName>",
      "Project name (defaults to the current project)"
    )
    .action(async (options) => {
      try {
        if (!authToken) {
          console.error(
            chalk.red("No authentication token found. Please login first.")
          );
          return;
        }

        try {
          // Use the resolveProject helper to get project information
          const projectData = await resolveProject(projectsApi, options);

          const spinner = ora(
            `Listing agents in project ${projectData.name}...`
          ).start();

          try {
            // Now get the agents for the specific project
            const agentsResponse: any =
              await agentsApi.machineAgentControllerGetMachineAgentByProjectId(
                projectData.id,
                0,
                10,
                AgentType.REGULAR
              );

            spinner.succeed("Successfully retrieved agents");

            // Display the results
            const agents = agentsResponse.data?.machineAgents || [];

            if (!agents || agents.length === 0) {
              console.log(
                chalk.yellow(`No agents found in project ${projectData.name}`)
              );
              return;
            }

            console.log(
              chalk.blue(`\nAgents in project ${projectData.name}:\n`)
            );

            // Create a formatted table focusing on id, name, and URL
            const table = new Table({
              head: [
                chalk.white.bold("ID"),
                chalk.white.bold("Name"),
                chalk.white.bold("URL"),
              ],
              style: {
                head: [], // Disable the default styling
                border: [],
              },
            });

            // Add agents to the table with the requested info
            agents.forEach((agent: any) => {
              // Format the agent URL
              let url = "N/A";
              if (agent.instanceIP) {
                // Construct an agent-specific URL if possible
                url = `${agent.instanceIP}/v1/agents/${agent.modelBaseId}/query`;
              }

              // Format date for readability
              let createdAt = agent.createdAt || "N/A";
              if (createdAt !== "N/A") {
                createdAt = new Date(createdAt).toLocaleString();
              }

              table.push([agent.id || "N/A", agent.agentName || "N/A", url]);
            });

            // Display the table
            console.log(table.toString());

            // Display totals
            console.log(`\nTotal agents: ${agents.length}`);
          } catch (error: any) {
            spinner.fail("Failed to retrieve agents");
            if (error.response) {
              console.error(
                chalk.red("API Error:"),
                error.response.data?.message || "Unknown error"
              );
            } else {
              console.error(
                chalk.red("Error:"),
                error.message || "Unknown error"
              );
            }
          }
        } catch (error: any) {
          console.error(
            chalk.red("Error:"),
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      } catch (error) {
        console.error(
          chalk.red("Error:"),
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    });

  // Remove agent
  agentCommand
    .command("remove")
    .description("Remove an AI agent")
    .requiredOption("--agent <agentId>", "Agent ID to remove")
    .option(
      "--project <projectName>",
      "Project name (defaults to the current project)"
    )
    .action(async (options) => {
      try {
        if (!authToken) {
          console.error(
            chalk.red("No authentication token found. Please login first.")
          );
          return;
        }

        const { agent } = options;

        // Use the resolveProject helper to get project information
        const projectData = await resolveProject(projectsApi, options);

        const spinner = ora(
          `Finding agent ${agent} in project ${projectData.name}...`
        ).start();

        try {
          // First, get the list of agents to find the correct modelbaseId
          const agentsResponse: any =
            await agentsApi.machineAgentControllerGetMachineAgentByProjectId(
              projectData.id,
              0,
              100, // Increased to make sure we get all agents
              AgentType.REGULAR
            );

          // Get the agents array
          const agents = agentsResponse.data?.machineAgents || [];

          // Find the specific agent by ID
          const targetAgent = agents.find(
            (a: any) => a.id.toString() === agent.toString()
          );

          if (!targetAgent) {
            spinner.fail(
              `Agent with ID ${agent} not found in project ${projectData.name}`
            );
            return;
          }

          // Extract the modelbaseId from the found agent
          const modelbaseId = targetAgent.modelBaseId;

          if (!modelbaseId) {
            spinner.fail(
              `Could not find modelbaseId for agent ${agent}. Please try again.`
            );
            return;
          }

          spinner.text = `Removing agent ${agent} from project ${projectData.name}...`;

          // Now remove the agent with the dynamically retrieved modelbaseId
          const payload: any = [
            {
              id: parseInt(agent, 10),
              modelbaseId: modelbaseId,
            },
          ];

          const removeResponse =
            await agentsApi.machineAgentControllerDeleteMachineAgents(
              projectData.id,
              agent,
              payload
            );

          spinner.succeed("Successfully removed agent");

          // Display the results
          console.log(
            chalk.green(
              `Agent ${agent} removed successfully from project ${projectData.name}`
            )
          );
        } catch (error: any) {
          spinner.fail("Failed to remove agent");
          if (error.response) {
            console.error(
              chalk.red("API Error:"),
              error.response.data?.message || "Unknown error"
            );
          } else {
            console.error(
              chalk.red("Error:"),
              error.message || "Unknown error"
            );
          }
        }
      } catch (error) {
        console.error(
          chalk.red("Error:"),
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    });

  agentCommand
    .command("deploy")
    .description("Deploy an AI agent to the Nestbox platform")
    .requiredOption("--agent <agentId>", "Agent ID to deploy")
    .requiredOption("--instance <instanceId>", "Instance ID")
    .option(
      "--zip <zipFileOrDirPath>",
      "Path to the zip file or directory to upload"
    )
    .option(
      "--project <projectName>",
      "Project name (defaults to the current project)"
    )
    .option("--entry <entryFunction>", "Entry function name", "main")
    .action(async (options) => {
      try {
        if (!authToken) {
          console.error(
            chalk.red("No authentication token found. Please login first.")
          );
          return;
        }

        const {
          agent: agentId,
          instance: instanceId,
          zip: customZipPath,
          entry,
        } = options;

        // Find project root (CLI tools directory)
        const projectRoot = await findProjectRoot();
        console.log(chalk.blue(`Project root detected at: ${projectRoot}`));

        // Use the resolveProject helper to get project information
        const projectData = await resolveProject(projectsApi, options);

        // Load nestbox.config.json from CLI tools directory
        const config = loadNestboxConfig(projectRoot);

        // Start the deployment process
        const spinner = ora(
          `Preparing to deploy agent ${agentId} to instance ${instanceId}...`
        ).start();

        try {
          // Determine the source path (custom path or project root)
          const sourcePath = customZipPath || projectRoot;

          let zipFilePath;

          // Check if the specified path exists
          if (!fs.existsSync(sourcePath)) {
            spinner.fail(`Path not found: ${sourcePath}`);
            return;
          }

          // Check if the path is a zip file or directory
          const stats = fs.statSync(sourcePath);

          if (stats.isFile()) {
            // Case 1: It's a file - verify it's a zip and use directly
            if (!sourcePath.toLowerCase().endsWith(".zip")) {
              spinner.fail(`File is not a zip archive: ${sourcePath}`);
              return;
            }

            // Use the zip file directly
            spinner.text = `Using provided zip file: ${sourcePath}`;
            zipFilePath = sourcePath;
          } else if (stats.isDirectory()) {
            // Case 2: It's a directory - check for predeploy scripts in CLI config

            // Determine if it's a TypeScript project
            const isTypeScript = isTypeScriptProject(sourcePath);

            if (isTypeScript) {
              spinner.text = `TypeScript project detected. Checking for predeploy scripts...`;

              // Run predeploy scripts if defined in CLI tools config
              if (config?.agent?.predeploy || config?.agents?.predeploy) {
                const predeployScripts =
                  config?.agent?.predeploy || config?.agents?.predeploy;
                spinner.text = `Running predeploy scripts on target directory...`;
                await runPredeployScripts(predeployScripts, sourcePath);
              } else {
                spinner.info(
                  "No predeploy scripts found in CLI tools nestbox.config.json"
                );
              }
            } else {
              // JavaScript directory - just zip it
              spinner.text = `JavaScript project detected. Skipping predeploy scripts.`;
            }

            // Create zip archive with node_modules excluded
            spinner.text = `Creating zip archive from directory ${sourcePath}...`;
            zipFilePath = createZipFromDirectory(sourcePath);
            spinner.text = `Directory zipped successfully to ${zipFilePath}`;
          } else {
            spinner.fail(`Unsupported file type: ${sourcePath}`);
            return;
          }

          spinner.text = `Deploying agent ${agentId} to instance ${instanceId}...`;

          // Clean the base URL to avoid path duplication
          const baseUrl = authToken?.serverUrl?.endsWith("/")
            ? authToken.serverUrl.slice(0, -1)
            : authToken?.serverUrl;

          const FormData = require("form-data");
          const form = new FormData();

          // Add file as a readable stream
          form.append("file", fs.createReadStream(zipFilePath));

          // Add all the required fields
          form.append("machineAgentId", agentId.toString());
          form.append("instanceId", instanceId.toString());
          form.append("entryFunctionName", entry);
          form.append("isSourceCodeUpdate", "true");
          form.append("projectId", projectData.id);

          // Create a custom axios instance with form-data headers
          const axiosInstance = axios.create({
            baseURL: baseUrl,
            headers: {
              ...form.getHeaders(),
              Authorization: authToken?.token,
            },
          });

          // Construct the endpoint URL
          const endpoint = `/projects/${projectData.id}/agents/${agentId}`;

          // Make direct axios request
          await axiosInstance.patch(endpoint, form);

          // Clean up temporary zip file if we created one
          if (zipFilePath !== sourcePath && fs.existsSync(zipFilePath)) {
            fs.unlinkSync(zipFilePath);
          }

          spinner.succeed(
            `Successfully deployed agent ${agentId} to instance ${instanceId}`
          );
          console.log(chalk.green("Agent deployed successfully"));
        } catch (error: any) {
          spinner.fail("Failed to deploy agent");

          if (error.response) {
            console.error(
              chalk.red(
                `API Error (${error.response.status}): ${error.response.data?.message || "Unknown error"}`
              )
            );
          } else {
            console.error(
              chalk.red("Error:"),
              error.message || "Unknown error"
            );
          }
        }
      } catch (error) {
        console.error(
          chalk.red("Error:"),
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    });
}
