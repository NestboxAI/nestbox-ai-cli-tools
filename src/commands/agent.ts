import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getAuthToken } from "../utils/auth";
import { Configuration, MachineAgentApi, MachineInstancesApi, ProjectsApi } from "@nestbox-ai/admin";
import { resolveProject } from "../utils/project";
import fs from "fs";
import yaml from 'js-yaml';
import {
  createNestboxConfig,
  createZipFromDirectory,
  downloadFromGoogleDrive,
  extractZip,
  findProjectRoot,
  isTypeScriptProject,
  loadNestboxConfig,
  runPredeployScripts,
  TEMPLATES,
} from "../utils/agent";
import axios from "axios";
import { AgentType } from "../types/agentType";
import { AgentYamlConfig } from "../types/agentYaml";
import inquirer from "inquirer";
import path from "path";
import { userData } from "../utils/user";

/**
 * Create a new agent in the Nestbox platform
 * 
 * @param agentName The name of the agent
 * @param options Options including lang, template, and project
 * @param agentsApi The MachineAgentApi instance
 * @param projectsApi The ProjectsApi instance
 */
async function createAgent(
  agentName: string, 
  options: {
    lang?: string;
    template?: string;
    project?: string;
    instanceName?: string;
    machineManifestId?: string;
    type?: string;
    goal?: string;
    modelBaseId?: string;
    machineName?: string;
    machineInstanceId?: number;
    instanceIP?: string;
    userId?: number;

    parameters?: Array<{name: string; description: string; default: any}>;
  }, 
  agentsApi?: MachineAgentApi,
  projectsApi?: ProjectsApi
): Promise<any> {
  const authToken = getAuthToken();
  if (!authToken) {
    throw new Error("No authentication token found. Please login first.");
  }

  // Create API instances if not provided
  if (!agentsApi || !projectsApi) {
    const configuration = new Configuration({
      basePath: authToken?.serverUrl,
      baseOptions: {
        headers: {
          Authorization: authToken?.token,
        },
      },
    });

    agentsApi = agentsApi || new MachineAgentApi(configuration);
    projectsApi = projectsApi || new ProjectsApi(configuration);
  }

  // Resolve project - convert options to match CommandOptions interface
  const projectData = await resolveProject(projectsApi, {
    project: options.project,
    instance: options.instanceName || '',
    ...options
  });

  // Prepare agent creation payload
  // Determine the correct type value based on options.type
  const agentTypeValue = options.type?.includes("AGENT") ? "REGULAR" : options.type || "CHAT";

  const payload: any = {
    agentName,
    goal: options.goal || `AI agent for ${agentName}`,
    modelBaseId: options.modelBaseId || "",
    machineName: options.machineName,
    machineInstanceId: options.machineInstanceId,
    instanceIP: options.instanceIP,
    machineManifestId: options.machineManifestId,
    parameters: options.parameters?.map((param: any) => ({
      name: param.name,
      description: param.description,
      default_value: param.default || "",
      isUserParam: param.isUserParam !== undefined ? param.isUserParam : true
    })) || [],
    projectId: projectData.id,
    type: agentTypeValue,
    userId: options.userId || 0,
  };

  // Determine the type of resource (Agent or Chat)
  const agentType = options.type || "CHAT";
  const resourceType = agentType === "AGENT" || agentType === "REGULAR" ? "Agent" : "Chatbot";

  // Create the agent
  const spinner = ora(`Creating ${resourceType.toLowerCase()} ${agentName}...`).start();
  
  try {
    const response = await agentsApi.machineAgentControllerCreateMachineAgent(
      projectData.id,
      payload
    );
    spinner.succeed(`${resourceType} '${agentName}' created successfully`);
    return response.data;
  } catch (error: any) {
    spinner.fail(`Failed to create ${resourceType.toLowerCase()} ${agentName}`);
    if (error.response && error.response.status === 401) {
      throw new Error('Authentication token has expired. Please login again using "nestbox login <domain>".');
    } else if (error.response) {
      throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || "Unknown error"}`);
    } else {
      throw new Error(error.message || "Unknown error");
    }
  }
}

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
  const instanceApi = new MachineInstancesApi(configuration)

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
            if (error.response && error.response.status === 401) {
              console.error(
                chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".')
              );
            } else if (error.response) {
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
              100,
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
          if (error.response && error.response.status === 401) {
            console.error(
              chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".')
            );
          } else if (error.response) {
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
        agent: agentName,
        chatbot: chatbotName,
        instance: instanceName,
        zip: customZipPath,
        entry,
      } = options;
      
      // Ensure either agent or chatbot is provided, but not both
      if ((!agentName && !chatbotName) || (agentName && chatbotName)) {
        console.error(
          chalk.red("Please provide either --agent OR --chatbot option, but not both.")
        );
        return;
      }

      // Find project root (CLI tools directory)
      const projectRoot = await findProjectRoot();
      console.log(chalk.blue(`Project root detected at: ${projectRoot}`));

      // Use the resolveProject helper to get project information
      const projectData = await resolveProject(projectsApi, options);

      // Determine if we're deploying an agent or chatbot
      const isAgent = !!agentName;
      const resourceName = isAgent ? agentName : chatbotName;
      const resourceType = isAgent ? "Agent" : "Chatbot";
      const agentType = isAgent ? AgentType.REGULAR : "CHAT";
      
      // Get agents data and find agent/chatbot by name
      const agentsData: any = await agentsApi.machineAgentControllerGetMachineAgentByProjectId(
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
      const instanceData: any = await instanceApi.machineInstancesControllerGetMachineInstanceByUserId(
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

      // Extract IDs for use in the rest of the original logic
      const agentId = targetAgent.id;
      const instanceId = targetInstance.id;

      // Load nestbox.config.json from CLI tools directory
      const config = loadNestboxConfig(projectRoot);

      // Start the deployment process
      const spinner = ora(
        `Preparing to deploy ${resourceType.toLowerCase()} ${agentId} to instance ${instanceId}...`
      ).start();

      try {
        let zipFilePath;

        if (customZipPath) {
          // User provided a custom zip path - use it directly
          if (!fs.existsSync(customZipPath)) {
            spinner.fail(`Path not found: ${customZipPath}`);
            return;
          }

          const stats = fs.statSync(customZipPath);

          if (stats.isFile()) {
            // It's a file - verify it's a zip and use directly
            if (!customZipPath.toLowerCase().endsWith(".zip")) {
              spinner.fail(`File is not a zip archive: ${customZipPath}`);
              return;
            }

            // Use the zip file directly (no predeploy scripts)
            spinner.text = `Using provided zip file: ${customZipPath}`;
            zipFilePath = customZipPath;
          } else if (stats.isDirectory()) {
            // It's a directory - process it
            spinner.text = `Processing directory: ${customZipPath}`;
            
            // Determine if it's a TypeScript project
            const isTypeScript = isTypeScriptProject(customZipPath);

            if (isTypeScript) {
              spinner.text = `TypeScript project detected. Checking for predeploy scripts...`;

              // Run predeploy scripts if defined in CLI tools config
              if (config?.agent?.predeploy || config?.agents?.predeploy) {
                const predeployScripts =
                  config?.agent?.predeploy || config?.agents?.predeploy;
                spinner.text = `Running predeploy scripts on target directory...`;
                await runPredeployScripts(predeployScripts, customZipPath);
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
            spinner.text = `Creating zip archive from directory ${customZipPath}...`;
            zipFilePath = createZipFromDirectory(customZipPath);
            spinner.text = `Directory zipped successfully to ${zipFilePath}`;
          } else {
            spinner.fail(`Unsupported file type: ${customZipPath}`);
            return;
          }
        } else {
          // No custom path - use project root
          spinner.text = `Using project root: ${projectRoot}`;
          
          // Determine if it's a TypeScript project
          const isTypeScript = isTypeScriptProject(projectRoot);

          if (isTypeScript) {
            spinner.text = `TypeScript project detected. Checking for predeploy scripts...`;

            // Run predeploy scripts if defined in CLI tools config
            if (config?.agent?.predeploy || config?.agents?.predeploy) {
              const predeployScripts =
                config?.agent?.predeploy || config?.agents?.predeploy;
              spinner.text = `Running predeploy scripts on project root...`;
              await runPredeployScripts(predeployScripts, projectRoot);
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
          spinner.text = `Creating zip archive from project root ${projectRoot}...`;
          zipFilePath = createZipFromDirectory(projectRoot);
          spinner.text = `Directory zipped successfully to ${zipFilePath}`;
        }

        spinner.text = `Deploying ${resourceType.toLowerCase()} ${agentId} to instance ${instanceId}...`;

        // Clean the base URL to avoid path duplication
        const baseUrl = authToken?.serverUrl?.endsWith("/")
          ? authToken.serverUrl.slice(0, -1)
          : authToken?.serverUrl;

        // Import FormData dynamically for ESM compatibility
        const { default: FormData } = await import("form-data");
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

        // Log API request details
        console.log(chalk.blue("Making API request:"));
        console.log(chalk.blue(`  URL: ${baseUrl}${endpoint}`));
        console.log(chalk.blue(`  Method: PATCH`));
        console.log(chalk.blue(`  machineAgentId: ${agentId}`));
        console.log(chalk.blue(`  instanceId: ${instanceId}`));
        console.log(chalk.blue(`  entryFunctionName: ${entry}`));
        console.log(chalk.blue(`  projectId: ${projectData.id}`));
        console.log(chalk.blue(`  File: ${path.basename(zipFilePath)}`));

        // Make direct axios request
        spinner.text = `Sending API request to deploy ${resourceType.toLowerCase()}...`;
        const res = await axiosInstance.patch(endpoint, form);
        
        // Log API response
        console.log(chalk.green("API Response received:"));
        console.log(chalk.green(`  Status: ${res.status} ${res.statusText}`));
        console.log(chalk.green(`  Data: ${JSON.stringify(res.data, null, 2)}`));

        if (!customZipPath && zipFilePath && fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }

        spinner.succeed(
          `Successfully deployed ${resourceType.toLowerCase()} ${agentId} to instance ${instanceId}`
        );
        console.log(chalk.green(`${resourceType} deployed successfully`));
      } catch (error: any) {
        spinner.fail(`Failed to deploy ${resourceType.toLowerCase()}`);

        // Log detailed API error information
        console.error(chalk.red("API Call Failed:"));
        
        if (error.response && error.response.status === 401) {
          console.error(
            chalk.red('Authentication token has expired. Please login again using "nestbox login <domain>".')
          );
          console.error(chalk.red("Response details:"));
          console.error(chalk.red(`  Status: ${error.response.status}`));
          console.error(chalk.red(`  Status Text: ${error.response.statusText}`));
          if (error.response.data) {
            console.error(chalk.red(`  Error Data: ${JSON.stringify(error.response.data, null, 2)}`));
          }
        } else if (error.response) {
          console.error(
            chalk.red(
              `API Error (${error.response.status}): ${error.response.data?.message || "Unknown error"}`
            )
          );
          console.error(chalk.red("Response details:"));
          console.error(chalk.red(`  Status: ${error.response.status}`));
          console.error(chalk.red(`  Status Text: ${error.response.statusText}`));
          if (error.response.data) {
            console.error(chalk.red(`  Error Data: ${JSON.stringify(error.response.data, null, 2)}`));
          }
        } else {
          console.error(
            chalk.red("Error:"),
            error.message || "Unknown error"
          );
          console.error(chalk.red("No response details available"));
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

        // Find matching template
        // Map the template types to the correct keys in the TEMPLATES object
        const templateMapping: Record<string, string> = {
          'agent': 'base',
          'chatbot': 'chatbot'
        };
        
        const mappedTemplateType = templateMapping[selectedTemplate] || selectedTemplate;
        const templateKey = `template-${mappedTemplateType}-${selectedLang}.zip`;
        const template = TEMPLATES[templateKey];

        if (!template) {
          spinner.fail(`Template not found for ${selectedTemplate} in ${selectedLang}`);
          console.log(chalk.yellow('Available templates:'));
          Object.entries(TEMPLATES).forEach(([key, value]: [string, any]) => {
            console.log(chalk.yellow(`  - ${value.type} (${value.lang}): ${value.name}`));
          });
          return;
        }

        spinner.text = `Downloading ${template.name} template...`;

        // Create temporary directory for download
        const tempDir = path.join(process.cwd(), '.temp-templates');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempZipPath = path.join(tempDir, templateKey);

        try {
          // Download template from Google Drive
          await downloadFromGoogleDrive(template.fileId, tempZipPath);
          
          spinner.text = `Extracting template to ${folder}...`;

          // Extract template to target folder
          extractZip(tempZipPath, folder);

          // Create nestbox.config.json for TypeScript projects
          createNestboxConfig(folder, selectedLang === 'ts');

          // Update package.json with project name if it exists
          const packageJsonPath = path.join(folder, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            packageJson.name = path.basename(folder);
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
          }

          // Clean up temp files
          fs.unlinkSync(tempZipPath);
          if (fs.readdirSync(tempDir).length === 0) {
            fs.rmdirSync(tempDir);
          }

          spinner.succeed(`Successfully generated ${template.name} project in ${folder}`);
          
          console.log(chalk.green("\nNext steps:"));
          console.log(chalk.yellow(`  cd ${folder}`));
          console.log(chalk.yellow("  npm install"));
          if (selectedLang === 'ts') {
            console.log(chalk.yellow("  npm run build"));
          }
          console.log(chalk.yellow("  nestbox agent deploy --agent <agent-name> --instance <instance-name>"));

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(tempZipPath)) {
            fs.unlinkSync(tempZipPath);
          }
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

  // Command for creating agents from YAML files
  agentCommand
    .command("create [firstArg] [secondArg]")
    .description("Create multiple agents from a YAML configuration file")
    .option("--project <projectId>", "Project ID (defaults to the current project)")
    .action(async (firstArg: string, secondArg: any, options: any) => {
      try {
        if (!authToken) {
          console.error(chalk.red("No authentication token found. Please login first."));
          return;
        }

        // Determine which argument is the YAML file path
        let yamlFilePath: string;
        
        if (firstArg === 'file' && secondArg) {
          // Format: nestbox agent create file <yamlFile>
          yamlFilePath = secondArg;
        } else if (firstArg) {
          // Format: nestbox agent create <yamlFile>
          yamlFilePath = firstArg;
          // In this case, secondArg might be options if using Commander's default parsing
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
          
          // Process each agent
          const results = {
            success: 0,
            failed: 0,
            agents: [] as Array<{name: string; success: boolean; message: string}>
          };
          
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
            
            // Determine the type of resource (Agent or Chat)
            let agentType = agent.type || "CHAT";
            // If type is "AGENT", convert it to "REGULAR" for API payload
            const payloadType = agentType === "AGENT" ? "REGULAR" : agentType;
            // Properly determine resource type based on exact agent type value
            const resourceType = agentType === "AGENT" ? "Agent" : "Chatbot";
            
            const agentSpinner = ora(`Creating ${resourceType.toLowerCase()} '${agent.name}'...`).start();

            const user = await userData();
            
            try {
              // Map YAML config to createAgent options with default values
              const createOptions = {
                ...options,
                goal: agent.goal || "No goal specified",
                modelBaseId: agent.modelBaseId || "",
                instanceIP: agent.instanceIP || "localhost",
                machineInstanceId: agent.machineInstanceId || 1,
                machineManifestId: agent.machineManifestId || "default",
                machineName: agent.machineName || `agent-${agent.name.toLowerCase()}`,
                // Set the original agent type, so createAgent can determine the resource type correctly
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
              
              // Update spinner text to use the correct resource type
              agentSpinner.text = `Creating ${resourceType.toLowerCase()} '${agent.name}'...`;
              
              // Create the agent
              await createAgent(agent.name, createOptions, agentsApi, projectsApi);
              
              // Always stop the spinner regardless of what createAgent does
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
              head: [], // Disable the default styling
              border: [],
            },
          });
          
          results.agents.forEach((agent, index) => {
            // Get the corresponding agent definition from the config to determine type
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
        console.error(
          chalk.red("Error:"),
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    });
}
