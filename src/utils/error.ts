// utils/error.ts
import { AuthApi, Configuration, OAuthLoginRequestDTOTypeEnum } from '@nestbox-ai/admin';
import { getAuthToken } from './auth';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

interface TokenRefreshResult {
  success: boolean;
  newToken?: string;
  error?: string;
}

/**
 * Attempts to refresh the authentication token using stored credentials
 */
async function refreshAuthToken(serverUrl: string, accessToken: string): Promise<TokenRefreshResult> {
  try {
    // Get the stored credentials to extract user info
    const configDir = path.join(os.homedir(), '.config', '.nestbox');
    const files = fs.readdirSync(configDir);
    
    // Find the credential file that matches this server URL
    let userCredentials: any = null;
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(configDir, file), 'utf8'));
        if (data.apiServerUrl === serverUrl && data.accessToken === accessToken) {
          userCredentials = data;
          break;
        }
      } catch (e) {
        // Skip invalid files
      }
    }

    if (!userCredentials) {
      return { success: false, error: 'Could not find stored credentials' };
    }

    // Create new configuration with the access token
    const configuration = new Configuration({
      basePath: serverUrl,
      accessToken: accessToken,
    });

    const authApi = new AuthApi(configuration);

    // Try to re-authenticate using the stored Google OAuth token
    const response = await authApi.authControllerOAuthLogin({
      providerId: accessToken,
      type: OAuthLoginRequestDTOTypeEnum.Google,
      email: userCredentials.email,
      profilePictureUrl: userCredentials.picture || '',
    });

    const newToken = response.data.token;

    // Update the stored credentials with the new token
    const fileName = `${userCredentials.email.replace('@', '_at_')}_${userCredentials.domain}.json`;
    const filePath = path.join(configDir, fileName);
    
    userCredentials.token = newToken;
    userCredentials.timestamp = new Date().toISOString();
    
    fs.writeFileSync(filePath, JSON.stringify(userCredentials, null, 2));

    return { success: true, newToken };
  } catch (error: any) {
    console.error(chalk.yellow('Token refresh failed:'), error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Enhanced 401 error handler with automatic token refresh
 */
export async function handle401Error(error: any, retryCallback?: () => Promise<any>): Promise<any> {
  if (error.response && error.response.status === 401) {
    // Get current auth token info
    const authInfo = getAuthToken();
    
    if (!authInfo || !authInfo.accessToken) {
      throw new Error('Authentication token has expired. Please login again using "nestbox login <domain>".');
    }

    console.log(chalk.yellow('Authentication token expired. Attempting to refresh...'));

    // Try to refresh the token
    const refreshResult = await refreshAuthToken(authInfo.serverUrl, authInfo.accessToken);

    if (refreshResult.success && retryCallback) {
      console.log(chalk.green('Token refreshed successfully. Retrying request...'));
      
      try {
        // Retry the original request with the new token
        const result = await retryCallback();
        return { success: true, data: result };
      } catch (retryError: any) {
        // If retry also fails with 401, the refresh didn't work properly
        if (retryError.response && retryError.response.status === 401) {
          throw new Error('Authentication failed after token refresh. Please login again using "nestbox login <domain>".');
        }
        // Re-throw other errors
        throw retryError;
      }
    } else {
      // Refresh failed
      throw new Error('Authentication token has expired and automatic refresh failed. Please login again using "nestbox login <domain>".');
    }
  }
  
  return null;
}

/**
 * Wrapper function to make API calls with automatic retry on 401
 */
export async function withTokenRefresh<T>(
  apiCall: () => Promise<T>,
  onRetry?: () => void
): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      // Get current auth token info
      const authInfo = getAuthToken();
      
      if (!authInfo || !authInfo.accessToken) {
        throw new Error('Authentication token has expired. Please login again using "nestbox login <domain>".');
      }

      console.log(chalk.yellow('Authentication token expired. Attempting to refresh...'));

      // Try to refresh the token
      const refreshResult = await refreshAuthToken(authInfo.serverUrl, authInfo.accessToken);

      if (refreshResult.success) {
        console.log(chalk.green('Token refreshed successfully. Retrying request...'));
        
        // If onRetry callback is provided, call it to reinitialize API clients
        if (onRetry) {
          onRetry();
        }
        
        try {
          // Retry the original API call
          return await apiCall();
        } catch (retryError: any) {
          // If retry also fails with 401, the refresh didn't work properly
          if (retryError.response && retryError.response.status === 401) {
            throw new Error('Authentication failed after token refresh. Please login again using "nestbox login <domain>".');
          }
          // Re-throw other errors
          throw retryError;
        }
      } else {
        // Refresh failed
        throw new Error('Authentication token has expired and automatic refresh failed. Please login again using "nestbox login <domain>".');
      }
    }
    
    // If not a 401 error, re-throw
    throw error;
  }
}