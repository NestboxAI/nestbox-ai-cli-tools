import path from "path";
import fs from 'fs';
import chalk from "chalk";
import ora from "ora";
import { promisify } from "util";
import { exec } from "child_process";
import AdmZip from "adm-zip";
import * as os from 'os';


const execAsync = promisify(exec);

export async function findProjectRoot(startDir = process.cwd()) {
  let currentDir = startDir;
  
  while (currentDir !== path.parse(currentDir).root) {
    const nestboxConfigPath = path.join(currentDir, 'nestbox.config.json');
    const packageJsonPath = path.join(currentDir, 'package.json');
    
    if (fs.existsSync(nestboxConfigPath) || fs.existsSync(packageJsonPath)) {
      return currentDir;
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  return startDir; // Fallback to current directory if no root markers found
}

// Function to load and parse nestbox.config.json if it exists
export function loadNestboxConfig(projectRoot: any) {
  const configPath = path.join(projectRoot, 'nestbox.config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error: any) {
      console.warn(chalk.yellow(`Warning: Error parsing nestbox.config.json: ${error.message}`));
    }
  }
  
  return null;
}

// Function to detect if a directory contains TypeScript files
export function isTypeScriptProject(directoryPath: any) {
  // Check for tsconfig.json
  if (fs.existsSync(path.join(directoryPath, 'tsconfig.json'))) {
    return true;
  }
  
  // Check for .ts files
  try {
    const files = fs.readdirSync(directoryPath);
    return files.some(file => file.endsWith('.ts') || file.endsWith('.tsx'));
  } catch (error) {
    return false;
  }
}

export async function runPredeployScripts(scripts: any, projectRoot: any) {
  if (!scripts || !Array.isArray(scripts) || scripts.length === 0) {
    return;
  }
  
  const spinner = ora('Running predeploy scripts...').start();

  try {
    for (const script of scripts) {
      spinner.text = `Running: ${script}`;
      
      // Make sure we're running in the correct directory
      await execAsync(script, { 
        cwd: projectRoot,
      });
    }
    spinner.succeed('Predeploy scripts completed successfully');
  } catch (error: any) {
    spinner.fail(`Predeploy script failed: ${error.message}`);
    throw new Error(`Predeploy failed: ${error.message}`);
  }
}

// Function to create zip from directory excluding node_modules
// export function createZipFromDirectory(dirPath: any, excludePatterns = ['node_modules']) {
//   const dirName = path.basename(dirPath);
//   const zipFilePath = path.join(os.tmpdir(), `${dirName}_${Date.now()}.zip`);
  
//   const zip = new AdmZip();
    
//   // Function to recursively add files to zip
//   function addFilesToZip(currentPath: any, relativePath = '') {
//     const items = fs.readdirSync(currentPath);
    
//     for (const item of items) {
//       const itemPath = path.join(currentPath, item);
//       const itemRelativePath = path.join(relativePath, item);
      
//       // Check if item should be excluded
//       if (excludePatterns.some(pattern => 
//         typeof pattern === 'string' ? itemRelativePath === pattern || item === pattern : 
//         pattern.test(itemRelativePath)
//       )) {
//         continue;
//       }
      
//       const stats = fs.statSync(itemPath);
      
//       if (stats.isDirectory()) {
//         addFilesToZip(itemPath, itemRelativePath);
//       } else {
//         zip.addLocalFile(itemPath, path.dirname(itemRelativePath));
//       }
//     }
//   }
  
//   addFilesToZip(dirPath);
//   zip.writeZip(zipFilePath);
  
//   return zipFilePath;
// }

export function createZipFromDirectory(dirPath: any, excludePatterns = ['node_modules', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']) {
  const dirName = path.basename(dirPath);
  const timestamp = Date.now();
  
  // Create zip in temp directory
  const tempZipFilePath = path.join(os.tmpdir(), `${dirName}_${timestamp}.zip`);
  
  // Create zip in Downloads folder (Mac)
  const downloadsPath = path.join(os.homedir(), 'Downloads');
  const downloadsZipFilePath = path.join(downloadsPath, `${dirName}_${timestamp}.zip`);
  
  const zip = new AdmZip();
    
  // Function to recursively add files to zip
  function addFilesToZip(currentPath: any, relativePath = '') {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const itemRelativePath = path.join(relativePath, item);
      
      // Check if item should be excluded
      if (excludePatterns.some(pattern => 
        typeof pattern === 'string' ? itemRelativePath === pattern || item === pattern : 
        pattern.test(itemRelativePath)
      )) {
        continue;
      }
      
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        addFilesToZip(itemPath, itemRelativePath);
      } else {
        zip.addLocalFile(itemPath, path.dirname(itemRelativePath));
      }
    }
  }
  
  addFilesToZip(dirPath);
  
  // Write zip to temp directory (for upload)
  zip.writeZip(tempZipFilePath);
  
  // Return the temp path for upload
  return tempZipFilePath;
}