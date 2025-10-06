import chalk from "chalk";
import { Configuration } from "@nestbox-ai/admin";
import { getAuthToken } from "./auth";
export interface AuthResult {
	authData: {
		apiURL: string;
		idToken: string;
		refreshToken: string;
		cliToken: string;
		expiresAt: string;
		email: string;
		picture: string;
		token: string;
	};
	configuration: Configuration;
}

/**
 * Common authentication and configuration setup
 * Returns authentication token and configured API client
 * Exits the process if authentication fails
 */
export async function setupAuthAndConfig(): Promise<AuthResult | null> {
	const authToken = await getAuthToken();

	if (!authToken) {
		console.error(
			chalk.red("No authentication token found. Please login first.")
		);
		return null;
	}

	const configuration = new Configuration({
		basePath: authToken.apiURL,
		baseOptions: {
			headers: {
				Authorization: authToken.token,
			},
		},
	});

	return {
		authData: authToken,
		configuration,
	};
}

/**
 * Wrapper function that ensures authentication is set up before executing a callback
 * Automatically handles authentication errors and provides configured API instances
 */
export async function withAuth<T>(
	callback: (authResult: AuthResult) => Promise<T>
): Promise<T | void> {
	const authResult = await setupAuthAndConfig();

	if (!authResult) {
		return;
	}

	try {
		return await callback(authResult);
	} catch (error: any) {
		if (error.response && error.response.status === 401) {
			console.error(
				chalk.red(
					'Authentication token has expired. Please login again using "nestbox login <domain>".'
				)
			);
		} else {
			throw error; // Re-throw non-auth errors
		}
	}
}
