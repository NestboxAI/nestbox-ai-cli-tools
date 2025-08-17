import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { UserCredentials } from '../types/auth';

// Config path
const CONFIG_DIR = path.join(os.homedir(), '.config', '.nestbox');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Get authentication token for a specific domain
 */
export function getAuthToken(domain?: string): {token: string, serverUrl: string, accessToken?: string} | null {
  try {
    const files = fs.readdirSync(CONFIG_DIR);

    if (!domain) {
      // If no domain is provided, return the first token found
      const tokenFiles = files.filter(file => file.endsWith('.json'));
      if (tokenFiles.length === 0) {
        return null;
      }
      
      const configData = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, tokenFiles[0])).toString());
      return {
        token: configData.token,
        serverUrl: configData.apiServerUrl,
        accessToken: configData.accessToken,
      };
    }
    const domainFiles = files.filter(file => file.endsWith(`_${domain}.json`));

    if (domainFiles.length === 0) {
      return null;
    }
    
    // If multiple accounts, sort by last used and take the most recent
    let configData: UserCredentials;
    
    if (domainFiles.length > 1) {
      const allConfigs = domainFiles.map(file => {
        const data = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file)).toString()) as UserCredentials;
        return {
          file,
          data,
        };
      });

      // Sort by last used, most recent first
      configData = allConfigs[0].data;
    } else {
      // Just one file
      const configFile = domainFiles[0];
      configData = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, configFile)).toString());
    }
    
    return {
      token: configData.token,
      serverUrl: configData.apiServerUrl,
      accessToken: configData.accessToken,
    }
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * List all saved credentials
 */
export function listCredentials(): Array<{
  domain: string;
  email: string;
  name?: string;
  authMethod?: string;
  lastUsed?: number;
}> {
  try {
    const files = fs.readdirSync(CONFIG_DIR);
    return files.map(file => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file)).toString()) as UserCredentials;
        return {
          domain: data.domain,
          email: data.email,
          name: data.name,
        };
      } catch (error) {
        // Skip invalid files
        return null;
      }
    }).filter(Boolean) as Array<{
      domain: string;
      email: string;
      name?: string;
      authMethod?: string;
      lastUsed?: number;
    }>;
  } catch (error) {
    console.error('Error listing credentials:', error);
    return [];
  }
}

/**
 * Remove credentials for a domain/email combination
 */
export function removeCredentials(domain: string, email?: string): boolean {
  try {
    const files = fs.readdirSync(CONFIG_DIR);
    let domainFiles: string[];
    
    if (email) {
      // Remove specific email for domain
      const emailFile = email.replace('@', '_at_');
      domainFiles = files.filter(file => file === `${emailFile}_${domain}.json`);
    } else {
      // Remove all for domain
      domainFiles = files.filter(file => file.endsWith(`_${domain}.json`));
    }
    
    if (domainFiles.length === 0) {
      return false;
    }
    
    domainFiles.forEach(file => {
      fs.unlinkSync(path.join(CONFIG_DIR, file));
    });
    
    return true;
  } catch (error) {
    console.error('Error removing credentials:', error);
    return false;
  }
}