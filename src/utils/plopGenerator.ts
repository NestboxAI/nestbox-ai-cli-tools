import path from "path";
import fs from 'fs';
import chalk from "chalk";
import nodePlop from 'node-plop';

export interface TemplateConfig {
  name: string;
  description: string;
  prompts: any[];
  actions: any[];
}

/**
 * Generate project using plop.js templates
 */
export async function generateWithPlop(
  templateType: string, 
  language: string, 
  targetFolder: string,
  projectName?: string,
  agentName?: string
): Promise<void> {
  // Create the target directory
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Set up plop programmatically
  const plop = await nodePlop('', {
    destBasePath: targetFolder,
    force: false
  });

  // Template mapping
  const templateMapping: Record<string, string> = {
    'agent': 'base',
    'chatbot': 'chatbot'
  };
  
  const mappedTemplateType = templateMapping[templateType] || templateType;
  const templatePath = path.resolve(__dirname, `../../templates/template-${mappedTemplateType}-${language}`);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  // Configure the generator
  const generatorName = `${mappedTemplateType}-${language}`;
  
  // Get the main template file path and target name
  const mainTemplateFile = language === 'ts' ? 'src/index.ts.hbs' : 'index.js.hbs';
  const targetFileName = language === 'ts' ? 'src/index.ts' : 'index.js';
  
  plop.setGenerator(generatorName, {
    description: `Generate a new ${mappedTemplateType} project in ${language}`,
    prompts: [],
    actions: [
      // Copy all non-template files
      {
        type: 'addMany',
        destination: '.',
        base: templatePath,
        templateFiles: `${templatePath}/**/*`,
        globOptions: {
          dot: true,
          ignore: ['**/node_modules/**', '**/*.hbs']
        }
      },
      // Add the main template file with proper naming
      {
        type: 'add',
        path: targetFileName,
        templateFile: path.join(templatePath, mainTemplateFile)
      }
    ]
  });

  // Run the generator
  const generator = plop.getGenerator(generatorName);
  await generator.runActions({
    name: projectName || path.basename(targetFolder),
    agentName: agentName || (templateType === 'agent' ? 'myAgent' : 'myChatbot')
  });

  // Update package.json with project name if provided
  if (projectName) {
    const packageJsonPath = path.join(targetFolder, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      packageJson.name = projectName;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
  }
}

/**
 * List available templates
 */
export function listAvailableTemplates(): string[] {
  const templatesDir = path.resolve(__dirname, '../../templates');
  if (!fs.existsSync(templatesDir)) {
    return [];
  }

  return fs.readdirSync(templatesDir)
    .filter(item => {
      const itemPath = path.join(templatesDir, item);
      return fs.statSync(itemPath).isDirectory() && item.startsWith('template-');
    })
    .map(item => item.replace('template-', '').replace(/\.(ts|js)$/, ''));
}
