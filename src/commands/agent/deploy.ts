import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import fs from "fs";
import {
  createZipFromDirectory,
  findProjectRoot,
  isTypeScriptProject,
  loadNestboxConfig,
  runPredeployScripts,
} from "../../utils/agent";
import axios from "axios";
import { AgentType } from "../../types/agentType";
import path from "path";
import { getAuthToken } from "../../utils/auth";
import { createApis } from "./apiUtils";

export function registerDeployCommand(agentCommand: Command): void {
  agentCommand
    .command("deploy")
    .description("Deploy an AI agent to the Nestbox platform")
    .option("--agent <agentName>", "Agent name to deploy")
    .option("--chatbot <chatbotName>", "Chatbot name to deploy")
    .requiredOption("--instance <instanceName>", "Instance name")
    .option(
      "--zip <zipFileOrDirPath>",
      "Path to the zip file or directory to upload"
    )
    .option(
      "--project <projectName>",
      "Project name (defaults to the current project)"
    )
    .option("--entry <entryFunction>", "Entry function name")
    .option("--log", "Show detailed logs during deployment")
    .action(async (options) => {
      try {
        const {
          agent: agentName,
          chatbot: chatbotName,
          instance: instanceName,
          zip: customZipPath,
          entry,
          log,
        } = options;
        
        // Ensure either agent or chatbot is provided, but not both
        if ((!agentName && !chatbotName) || (agentName && chatbotName)) {
          console.error(
            chalk.red("Please provide either --agent OR --chatbot option, but not both.")
          );
          return;
        }

        let apis = createApis();

        // Find project root
        const projectRoot = await findProjectRoot();
        console.log(chalk.blue(`Project root detected at: ${projectRoot}`));

        // Main deployment logic with token refresh
        await withTokenRefresh(
          async () => {
            // Resolve project
            const projectData = await resolveProject(apis.projectsApi, options);

            // Determine if we're deploying an agent or chatbot
            const isAgent = !!agentName;
            const resourceName = isAgent ? agentName : chatbotName;
            const resourceType = isAgent ? "Agent" : "Chatbot";
            const agentType = isAgent ? AgentType.REGULAR : "CHAT";
            
            // Get agents data and find agent/chatbot by name
            const agentsData: any = await apis.agentsApi.machineAgentControllerGetMachineAgentByProjectId(
              projectData.id, 
              0, 
              10, 
              agentType
            );

            const targetAgent = agentsData.data.machineAgents.find(
              (agent: any) => agent.agentName === resourceName
            );

            if (!targetAgent) {
              console.error(
                chalk.red(`${resourceType} with name "${resourceName}" not found in project "${projectData.name}".`)
              );
              console.log(chalk.yellow(`Available ${resourceType.toLowerCase()}s:`));
              agentsData.data.machineAgents.forEach((agent: any) => {
                console.log(chalk.yellow(`  - ${agent.agentName} (ID: ${agent.id})`));
              });
              return;
            }

            // Get instance data and find instance by name
            const instanceData: any = await apis.instanceApi.machineInstancesControllerGetMachineInstanceByUserId(
              projectData.id, 
              0, 
              10
            );

            const targetInstance = instanceData.data.machineInstances.find(
              (instance: any) => instance.instanceName === instanceName
            );

            if (!targetInstance) {
              console.error(
                chalk.red(`Instance with name "${instanceName}" not found in project "${projectData.name}".`)
              );
              console.log(chalk.yellow("Available instances:"));
              instanceData.data.machineInstances.forEach((instance: any) => {
                console.log(chalk.yellow(`  - ${instance.instanceName} (ID: ${instance.id})`));
              });
              return;
            }

            // Extract IDs
            const agentId = targetAgent.id;
            const resolvedEntry = entry || targetAgent.entryFunctionName || "main";
            const instanceId = targetInstance.id;

            // Load nestbox.config.json
            const config = loadNestboxConfig(projectRoot);

            // Start the deployment process
            const spinner = ora(
              `Preparing to deploy ${resourceType.toLowerCase()} ${agentId} to instance ${instanceId}...`
            ).start();

            try {
              let zipFilePath;

              if (customZipPath) {
                // Process custom zip path
                if (!fs.existsSync(customZipPath)) {
                  spinner.fail(`Path not found: ${customZipPath}`);
                  return;
                }

                const stats = fs.statSync(customZipPath);

                if (stats.isFile()) {
                  if (!customZipPath.toLowerCase().endsWith(".zip")) {
                    spinner.fail(`File is not a zip archive: ${customZipPath}`);
                    return;
                  }
                  spinner.text = `Using provided zip file: ${customZipPath}`;
                  zipFilePath = customZipPath;
                } else if (stats.isDirectory()) {
                  // Process directory
                  spinner.text = `Processing directory: ${customZipPath}`;
                  
                  const isTypeScript = isTypeScriptProject(customZipPath);

                  if (isTypeScript && (config?.agent?.predeploy || config?.agents?.predeploy)) {
                    const predeployScripts = config?.agent?.predeploy || config?.agents?.predeploy;
                    spinner.text = `Running predeploy scripts on target directory...`;
                    await runPredeployScripts(predeployScripts, customZipPath);
                  }

                  spinner.text = `Creating zip archive from directory ${customZipPath}...`;
                  zipFilePath = createZipFromDirectory(customZipPath);
                  spinner.text = `Directory zipped successfully to ${zipFilePath}`;
                }
              } else {
                // Use project root
                spinner.text = `Using project root: ${projectRoot}`;
                
                const isTypeScript = isTypeScriptProject(projectRoot);

                if (isTypeScript && (config?.agent?.predeploy || config?.agents?.predeploy)) {
                  const predeployScripts = config?.agent?.predeploy || config?.agents?.predeploy;
                  spinner.text = `Running predeploy scripts on project root...`;
                  await runPredeployScripts(predeployScripts, projectRoot);
                }

                spinner.text = `Creating zip archive from project root ${projectRoot}...`;
                zipFilePath = createZipFromDirectory(projectRoot);
                spinner.text = `Directory zipped successfully to ${zipFilePath}`;
              }

              spinner.text = `Deploying ${resourceType.toLowerCase()} ${agentId} to instance ${instanceId}...`;

              // Prepare deployment
              const authToken = getAuthToken();
              const baseUrl = authToken?.serverUrl?.endsWith("/")
                ? authToken.serverUrl.slice(0, -1)
                : authToken?.serverUrl;

              const { default: FormData } = await import("form-data");
              const form = new FormData();

              form.append("file", fs.createReadStream(zipFilePath));
              form.append("machineAgentId", agentId.toString());
              form.append("instanceId", instanceId.toString());
              form.append("entryFunctionName", resolvedEntry);
              form.append("isSourceCodeUpdate", "true");
              form.append("projectId", projectData.id);

              if (log) {
                console.log(chalk.blue("Form Details "));
                console.log(chalk.blue(`  - File: ${path.basename(zipFilePath)}`));
                console.log(chalk.blue(`  - Agent ID: ${agentId}`));
                console.log(chalk.blue(`  - Instance ID: ${instanceId}`));
                console.log(chalk.blue(`  - Entry Function: ${resolvedEntry}`));
                console.log(chalk.blue(`  - Project ID: ${projectData.id}`));
              }

              const axiosInstance = axios.create({
                baseURL: baseUrl,
                headers: {
                  ...form.getHeaders(),
                  Authorization: authToken?.token,
                },
              });

              const endpoint = `/projects/${projectData.id}/agents/${agentId}`;

              spinner.text = `Deploy ${resourceType.toLowerCase()} ${agentName}...`;
              const res = await axiosInstance.patch(endpoint, form);
              
              if (!customZipPath && zipFilePath && fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
              }

              if (log) {
                console.log(chalk.blue("\nDeployment request:"));
                console.log(chalk.blue(`  URL: ${baseUrl}${endpoint}`));
                console.log(chalk.blue(`  Method: PATCH`));
                console.log(chalk.blue(`  File: ${path.basename(zipFilePath)}`));  
                console.log(chalk.blue(`  Response status: ${res.status} ${res.statusText}`));
                const lines = res.data.logEntries || [];
                console.log(chalk.blue(`  Deployment log entries (${lines.length} lines):`));
                lines.forEach((line:  any) => {
                  console.log(chalk.blue(`    - [${line.type} ${line.timestamp}] ${line.message} `));
                });
              }
              spinner.succeed("Successfully deployed");
              console.log(chalk.green(`${resourceType} deployed successfully!`));
              console.log(chalk.cyan(`📍 Instance: ${instanceName}`));
              console.log(chalk.cyan(`🤖 Agent: ${agentName} (${agentId})`));
              console.log(chalk.cyan(`⚙️ Entry: ${resolvedEntry}`));
              console.log(chalk.cyan(`🔄 Process: ${res.data.processName}`));
            } catch (error: any) {
              spinner.fail(`Failed to deploy ${resourceType.toLowerCase()}`);
              throw error;
            }
          },
          () => {
            apis = createApis();
          }
        );
      } catch (error: any) {
        if (error.message && error.message.includes('Authentication')) {
          console.error(chalk.red(error.message));
        } else if (error.response) {
          console.error(
            chalk.red(
              `API Error (${error.response.status}): ${error.response.data?.message || "Unknown error"}`
            )
          );
          if (error.response.data) {
            console.error(chalk.red(`Error Data: ${JSON.stringify(error.response.data, null, 2)}`));
          }
        } else {
          console.error(chalk.red("Error:"), error.message || "Unknown error");
        }
      }
    });
}
