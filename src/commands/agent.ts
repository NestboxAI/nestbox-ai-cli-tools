import { Command } from "commander";
import { handle401Error, withTokenRefresh } from "../utils/error";
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
  // Function to create/recreate API instances
  const createApis = () => {
    const authToken = getAuthToken();
    if (!authToken) {
      throw new Error('No authentication token found. Please log in first.');
    }
    
    const configuration = new Configuration({
      basePath: authToken.serverUrl,
      baseOptions: {
        headers: {
          Authorization: authToken.token,
        },
      },
    });

    return {
      agentsApi: new MachineAgentApi(configuration),
      projectsApi: new ProjectsApi(configuration),
      instanceApi: new MachineInstancesApi(configuration)
    };
  };

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
        let apis = createApis();

        // Execute with token refresh support
        await withTokenRefresh(
          async () => {
            // Resolve project
            const projectData = await resolveProject(apis.projectsApi, options);

            const spinner = ora(
              `Listing agents in project ${projectData.name}...`
            ).start();

            try {
              // Get the agents for the specific project
              const agentsResponse: any =
                await apis.agentsApi.machineAgentControllerGetMachineAgentByProjectId(
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

              // Create a formatted table
              const table = new Table({
                head: [
                  chalk.white.bold("ID"),
                  chalk.white.bold("Name"),
                  chalk.white.bold("URL"),
                ],
                style: {
                  head: [],
                  border: [],
                },
              });

              // Add agents to the table
              agents.forEach((agent: any) => {
                let url = "N/A";
                if (agent.instanceIP) {
                  url = `${agent.instanceIP}/v1/agents/${agent.modelBaseId}/query`;
                }

                table.push([agent.id || "N/A", agent.agentName || "N/A", url]);
              });

              console.log(table.toString());
              console.log(`\nTotal agents: ${agents.length}`);
              
            } catch (error: any) {
              spinner.fail("Failed to retrieve agents");
              throw error;
            }
          },
          () => {
            // Recreate APIs after token refresh
            apis = createApis();
          }
        );
      } catch (error: any) {
        if (error.message && error.message.includes('Authentication')) {
          console.error(chalk.red(error.message));
        } else if (error.response?.data?.message) {
          console.error(chalk.red("API Error:"), error.response.data.message);
        } else {
          console.error(chalk.red("Error:"), error.message || "Unknown error");
        }
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
        let apis = createApis();
        const { agent } = options;

        await withTokenRefresh(
          async () => {
            // Resolve project
            const projectData = await resolveProject(apis.projectsApi, options);

            const spinner = ora(
              `Finding agent ${agent} in project ${projectData.name}...`
            ).start();

            try {
              // Get the list of agents to find the correct modelbaseId
              const agentsResponse: any =
                await apis.agentsApi.machineAgentControllerGetMachineAgentByProjectId(
                  projectData.id,
                  0,
                  100,
                  AgentType.REGULAR
                );

              const agents = agentsResponse.data?.machineAgents || [];
              const targetAgent = agents.find(
                (a: any) => a.id.toString() === agent.toString()
              );

              if (!targetAgent) {
                spinner.fail(
                  `Agent with ID ${agent} not found in project ${projectData.name}`
                );
                return;
              }

              const modelbaseId = targetAgent.modelBaseId;
              if (!modelbaseId) {
                spinner.fail(
                  `Could not find modelbaseId for agent ${agent}. Please try again.`
                );
                return;
              }

              spinner.text = `Removing agent ${agent} from project ${projectData.name}...`;

              // Remove the agent
              const payload: any = [
                {
                  id: parseInt(agent, 10),
                  modelbaseId: modelbaseId,
                },
              ];

              await apis.agentsApi.machineAgentControllerDeleteMachineAgents(
                projectData.id,
                agent,
                payload
              );

              spinner.succeed("Successfully removed agent");
              console.log(
                chalk.green(
                  `Agent ${agent} removed successfully from project ${projectData.name}`
                )
              );
            } catch (error: any) {
              spinner.fail("Failed to remove agent");
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
        } else if (error.response?.data?.message) {
          console.error(chalk.red("API Error:"), error.response.data.message);
        } else {
          console.error(chalk.red("Error:"), error.message || "Unknown error");
        }
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
              form.append("entryFunctionName", entry);
              form.append("isSourceCodeUpdate", "true");
              form.append("projectId", projectData.id);

              const axiosInstance = axios.create({
                baseURL: baseUrl,
                headers: {
                  ...form.getHeaders(),
                  Authorization: authToken?.token,
                },
              });

              const endpoint = `/projects/${projectData.id}/agents/${agentId}`;

              console.log(chalk.blue("\nMaking API request:"));
              console.log(chalk.blue(`  URL: ${baseUrl}${endpoint}`));
              console.log(chalk.blue(`  Method: PATCH`));
              console.log(chalk.blue(`  File: ${path.basename(zipFilePath)}`));

              spinner.text = `Sending API request to deploy ${resourceType.toLowerCase()}...`;
              const res = await axiosInstance.patch(endpoint, form);
              
              console.log(chalk.green("\nAPI Response received:"));
              console.log(chalk.green(`  Status: ${res.status} ${res.statusText}`));

              if (!customZipPath && zipFilePath && fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
              }

              spinner.succeed(
                `Successfully deployed ${resourceType.toLowerCase()} ${agentId} to instance ${instanceId}`
              );
              console.log(chalk.green(`${resourceType} deployed successfully`));
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
          templatePath = path.resolve(__dirname, '../../templates', templateKey);
        }
        if (!fs.existsSync(templatePath)) {
          spinner.fail(`Template not found: ${templatePath}`);
          // Show available templates in both locations
          const cwdTemplates = path.resolve(process.cwd(), 'templates');
          const dirTemplates = path.resolve(__dirname, '../../templates');
          let shown = false;
          if (fs.existsSync(cwdTemplates)) {
            console.log(chalk.yellow('Available templates in ./templates:'));
            fs.readdirSync(cwdTemplates).forEach(file => {
              console.log(chalk.yellow(`  - ${file}`));
            });
            shown = true;
          }
          if (fs.existsSync(dirTemplates)) {
            console.log(chalk.yellow('Available templates in src/commands/../../templates:'));
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

  // Command for creating agents from YAML files
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