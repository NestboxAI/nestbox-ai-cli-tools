import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import open from "open";
import ora from "ora";
import fs from "fs";
import os from "os";
import path from "path";
import {
	AuthApi,
	Configuration,
	OAuthLoginRequestDTOTypeEnum,
} from "@nestbox-ai/admin";
import axios from "axios";

export function registerLoginCommand(program: Command): void {
	program
		.command("login <nestbox-domain>")
		.description("Login using Google SSO")
		.action(async (domain: string) => {
			console.log("Login command triggered for domain:", domain);
			const spinner = ora("Initiating Google login...").start();

			try {
				// Determine the protocol and construct the auth URL based on the provided domain
				let authUrl;
				if (domain.includes("localhost")) {
					// Use HTTP for localhost and specific port
					authUrl = `http://${domain}/cli/auth?state=offline`;
				} else {
					// Use HTTPS for all other domains
					authUrl = `https://${domain}/cli/auth?state=offline`;
				}

				spinner.text = "Opening browser for Google authentication...";

				// Open the browser for authentication
				await open(authUrl);
				spinner.succeed("Browser opened for authentication");

				// Prompt user to paste the combined token and API URL
				const { combinedInput } = await inquirer.prompt<{
					combinedInput: string;
				}>([
					{
						type: "input",
						name: "combinedInput",
						message:
							"After authenticating, please paste the data here:",
						validate: input =>
							input.trim().length > 0 || "Input is required",
					},
				]);

				// Split the input by comma
				const [cliToken, apiURL, idToken, refreshToken] = combinedInput
					.split(",")
					.map(item => item.trim());

				if (!cliToken || !apiURL || !idToken || !refreshToken) {
					spinner.fail(
						"Invalid input format. Expected: token,apiServerUrl"
					);
					return;
				}

				console.log(
					chalk.green(
						"Credentials received. Extracting user information..."
					)
				);

				// Fetch user data from the token
				let email = "";
				let name = "";
				let picture = "";
				let expiresAt = "";
				try {
					// Try to decode JWT to get user data (email, name, picture, etc.)
					const tokenParts = cliToken.split(".");
					if (tokenParts.length === 3) {
						// Base64 decode the payload part of JWT
						const base64Payload = tokenParts[1]
							.replace(/-/g, "+")
							.replace(/_/g, "/");
						const decodedPayload = Buffer.from(
							base64Payload,
							"base64"
						).toString("utf-8");
						const tokenPayload = JSON.parse(decodedPayload);

						// Extract user information
						email = tokenPayload.email || "";
						name = tokenPayload.name || "";
						picture = tokenPayload.picture || "";
						expiresAt = tokenPayload.exp || "";
					}
				} catch (e) {
					console.log(
						chalk.yellow(
							"Could not decode token payload. Will prompt for email."
						)
					);
				}

				// If email couldn't be extracted from token, prompt user
				if (!email) {
					const response = await inquirer.prompt<{ email: string }>([
						{
							type: "input",
							name: "email",
							message: "Enter your email address:",
							validate: input =>
								/\S+@\S+\.\S+/.test(input) ||
								"Please enter a valid email",
						},
					]);
					email = response.email;
				}

				spinner.start("Verifying access token...");

				if (apiURL && email && cliToken) {
					// Verify the access token
					const configuration = new Configuration({
						basePath: apiURL,
						accessToken: cliToken,
					});
					const authApi = new AuthApi(configuration);
					try {
						const response = await authApi.authControllerOAuthLogin(
							{
								providerId: cliToken,
								type: OAuthLoginRequestDTOTypeEnum.Google,
								email,
								profilePictureUrl: picture || "",
							}
						);
						const authResponse = response.data;

						// Save credentials to file
						try {
							// Create directory structure
							const configDir = path.join(
								os.homedir(),
								".config",
								".nestbox"
							);
							if (!fs.existsSync(configDir)) {
								fs.mkdirSync(configDir, { recursive: true });
							}

							// Create the file path
							const fileName = `${email.replace("@", "_at_")}_${domain}.json`;
							const filePath = path.join(configDir, fileName);

							// Create credentials object
							const credentials = {
								apiURL: apiURL,
								idToken: idToken,
								cliToken: cliToken,
								refreshToken: refreshToken,
								expiresAt: expiresAt,
								email,
								name,
								picture,
							};

							// Write to file
							fs.writeFileSync(
								filePath,
								JSON.stringify(credentials, null, 2)
							);

							spinner.succeed("Authentication successful");
							console.log(
								chalk.green(
									`Successfully logged in as ${email}`
								)
							);
							console.log(
								chalk.blue(`Credentials saved to: ${filePath}`)
							);
						} catch (fileError) {
							spinner.warn(
								"Authentication successful, but failed to save credentials file"
							);
							console.error(
								chalk.yellow("File error:"),
								fileError instanceof Error
									? fileError.message
									: "Unknown error"
							);
						}
					} catch (authError) {
						spinner.fail("Failed to verify access token");
						if (
							axios.isAxiosError(authError) &&
							authError.response
						) {
							if (
								authError.response.data.message ===
								"user.not_found"
							) {
								console.error(
									chalk.red("Authentication Error:"),
									"You need to register your email with the Nestbox platform"
								);
								const { openSignup } = await inquirer.prompt<{
									openSignup: boolean;
								}>([
									{
										type: "confirm",
										name: "openSignup",
										message:
											"Would you like to open the signup page to register?",
										default: true,
									},
								]);

								if (openSignup) {
									// Construct signup URL with the same protocol logic as login
									let signupUrl;
									if (domain.includes("localhost")) {
										signupUrl = `http://${domain}`;
									} else {
										signupUrl = `https://${domain}`;
									}

									console.log(
										chalk.blue(
											`Opening signup page: ${signupUrl}`
										)
									);
									await open(signupUrl);
								}
							}
						} else {
							console.error(
								chalk.red("Authentication Error:"),
								authError instanceof Error
									? authError.message
									: "Unknown error"
							);
						}
					}
				} else {
					spinner.fail(
						"Missing required information for authentication"
					);
				}
			} catch (error) {
				spinner.fail("Authentication failed");
				console.error(
					chalk.red("Error:"),
					error instanceof Error ? error.message : "Unknown error"
				);
			}
		});
}
