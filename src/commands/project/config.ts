import fs from 'fs';
import path from 'path';

// Define a type for the projects configuration
interface ProjectsConfig {
    default?: string;
    [key: string]: string | undefined;
}

interface NestboxConfig {
    projects: ProjectsConfig;
}

// Utility functions for project configuration
export function getNestboxConfigPath(): string {
    return path.join(process.cwd(), '.nestboxrc');
}

export function readNestboxConfig(): NestboxConfig {
    const configPath = getNestboxConfigPath();
    if (fs.existsSync(configPath)) {
        try {
            const content = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return { projects: {} };
        }
    }
    return { projects: {} };
}

export function writeNestboxConfig(config: NestboxConfig): void {
    const configPath = getNestboxConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export type { ProjectsConfig, NestboxConfig };
