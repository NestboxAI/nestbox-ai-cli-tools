import path from "path";
import fs from "fs";
import nodePlop from "node-plop";

export interface TemplateConfig {
  name: string;
  description: string;
  prompts: any[];
  actions: any[];
}

const kebabize = (str: string) =>
  str
    // Convert underscores to hyphens
    .replace(/_/g, "-")
    // Insert hyphen before capitals (handles acronyms)
    .replace(
      /[A-Z]+(?![a-z])|[A-Z]/g,
      (match, offset) => (offset ? "-" : "") + match.toLowerCase()
    )
    // Normalize multiple hyphens
    .replace(/-+/g, "-")
    // Trim hyphens
    .replace(/^-|-$/g, "");

/**
 * Generate project using plop.js templates
 */
export async function generateWithPlop(
  templateType: string,
  language: string,
  targetFolder: string,
  projectName?: string,
  agentName?: string
): Promise<{ agentNameInYaml: string }> {
  // Create the target directory
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Set up plop programmatically
  const plop = await nodePlop("", {
    destBasePath: targetFolder,
    force: false,
  });

  // Template mapping
  const templateMapping: Record<string, string> = {
    agent: "base",
    chatbot: "chatbot",
  };

  const mappedTemplateType = templateMapping[templateType] || templateType;
  const templatePath = path.resolve(
    __dirname,
    `../../templates/${mappedTemplateType}-${language}`
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  // Configure the generator
  const generatorName = `${mappedTemplateType}-${language}`;

  // Get the main template file path and target name
  const mainTemplateFile =
    language === "ts" ? "src/index.ts.hbs" : "index.js.hbs";
  const targetFileName = language === "ts" ? "src/index.ts" : "index.js";

  plop.setGenerator(generatorName, {
    description: `Generate a new ${mappedTemplateType} project in ${language}`,
    prompts: [],
    actions: [
      // Copy all non-template files
      {
        type: "addMany",
        destination: ".",
        base: templatePath,
        templateFiles: `${templatePath}/**/*`,
        globOptions: {
          dot: true,
          ignore: ["**/node_modules/**", "**/*.hbs"],
        },
      },
      {
        type: "add",
        path: targetFileName,
        templateFile: path.join(templatePath, mainTemplateFile),
      },
      {
        type: "add",
        path: "nestbox-agents.yaml",
        templateFile: path.join(templatePath, "nestbox-agents.yaml.hbs"),
      },
    ],
  });

  // Run the generator
  const generator = plop.getGenerator(generatorName);
  const agentNameFinal =
    agentName || (templateType === "agent" ? "myAgent" : "myChatbot");
  const agentNameInYaml = kebabize(agentNameFinal);
  await generator.runActions({
    name: projectName || path.basename(targetFolder),
    agentName: agentNameFinal,
    agentNameInYaml,
  });

  // Update package.json with project name if provided
  if (projectName) {
    const packageJsonPath = path.join(targetFolder, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      packageJson.name = projectName;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
  }

  return {
    agentNameInYaml,
  }
}

/**
 * List available templates
 */
export function listAvailableTemplates(): string[] {
  const templatesDir = path.resolve(__dirname, "../../templates");
  if (!fs.existsSync(templatesDir)) {
    return [];
  }

  return fs
    .readdirSync(templatesDir)
    .filter((item) => {
      const itemPath = path.join(templatesDir, item);
      return fs.statSync(itemPath).isDirectory();
    })
    .map((item) => item.replace(/\.(ts|js)$/, ""));
}
