import { Command } from "commander";
import { withTokenRefresh } from "../../utils/error";
import chalk from "chalk";
import ora from "ora";
import { resolveProject } from "../../utils/project";
import { AgentType } from "../../types/agentType";
import { createApis } from "./apiUtils";

export function registerRemoveCommand(agentCommand: Command): void {
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
}
