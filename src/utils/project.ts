import { ProjectsApi } from "@nestbox-ai/admin";
import ora from "ora";
import { readNestboxConfig } from "../commands/projects";


interface ProjectInfo {
    id: string;
    name: string;
  }

interface CommandOptions {
    instance: string;
    project?: string;
    collection?: string;
    name?: string;
    metadata?: string;
    [key: string]: any;
}

export async function resolveProject(projectsApi: ProjectsApi, options: CommandOptions): Promise<ProjectInfo> {
  const spinner = ora('Resolving project...').start();
  
  try {
    const projectsResponse = await projectsApi.projectControllerGetAllProjects();
    const allProjects = projectsResponse.data?.data?.projects;

    if (!allProjects || allProjects.length === 0) {
      spinner.fail('No projects found.');
      throw new Error('No projects found');
    }

    let projectId = options.project;
    let projectName = '';

    if (projectId) {
      const byId = allProjects.find((p) => p.id === projectId);
      const byName = allProjects.find((p) => p.name === projectId);

      if (byId) {
        projectName = byId.name;
        projectId = byId.id;
      } else if (byName) {
        projectName = byName.name;
        projectId = byName.id;
      } else {
        spinner.fail(`Project not found with ID or name: ${projectId}`);
        throw new Error(`Project not found with ID or name: ${projectId}`);
      }

      spinner.succeed(`Using project: ${projectName} (ID: ${projectId})`);
    } else {
      const config = readNestboxConfig();
      const defaultProjectName = config.projects?.default;

      if (!defaultProjectName) {
        spinner.fail('No project specified and no default project set. Please provide a project ID or set a default project.');
        throw new Error('No project specified and no default project set');
      }

      const defaultProject = allProjects.find((p) => p.name === defaultProjectName);

      if (!defaultProject) {
        spinner.fail(`Default project "${defaultProjectName}" not found.`);
        throw new Error(`Default project "${defaultProjectName}" not found.`);
      }

      projectId = defaultProject.id;
      projectName = defaultProject.name;
      spinner.succeed(`Using default project: ${projectName} (ID: ${projectId})`);
    }

    return { id: projectId, name: projectName };
  } catch (error) {
    if (!spinner.isSpinning) {
      // If spinner was already stopped with fail, we don't need to fail it again
      throw error;
    }
    spinner.fail('Failed to resolve project');
    throw error;
  }
}