import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs";
import os from "os";
import path from "path";
import {
	getAuthToken,
	listCredentials,
	removeCredentials,
} from "../../utils/auth";

export function registerLogoutCommand(program: Command): void {
	program
		.command("logout [nestbox-domain]")
		.description("Logout from Nestbox platform")
		.action(async (domain?: string) => {
			try {
				const authToken = getAuthToken(domain);
				if (!authToken) {
					console.log(
						chalk.yellow(
							"No authentication token found. Please log in first."
						)
					);
					return;
				}

				// Function to remove all credential files for a domain
				const removeCredentialFiles = (domain: string) => {
					try {
						const configDir = path.join(
							os.homedir(),
							".config",
							".nestbox"
						);
						if (!fs.existsSync(configDir)) {
							return false;
						}

						// Sanitize domain for file matching
						// Replace characters that are problematic in filenames
						const sanitizedDomain = domain.replace(/:/g, "_");

						// Get all files in the directory
						const files = fs.readdirSync(configDir);

						// Find and remove all files that match the domain
						let removedCount = 0;
						for (const file of files) {
							// Check if the file matches any of the possible domain formats
							if (
								file.endsWith(`_${domain}.json`) ||
								file.endsWith(`_${sanitizedDomain}.json`)
							) {
								fs.unlinkSync(path.join(configDir, file));
								removedCount++;
							}
						}

						return removedCount > 0;
					} catch (error) {
						console.warn(
							chalk.yellow(
								`Warning: Could not remove credential files. ${error instanceof Error ? error.message : ""}`
							)
						);
						return false;
					}
				};

				if (domain) {
					// Logout from specific domain
					// Remove credentials using utility function
					const removed = removeCredentials(domain);

					// Also remove all credential files for this domain
					const filesRemoved = removeCredentialFiles(domain);

					if (removed || filesRemoved) {
						console.log(
							chalk.green(
								`Successfully logged out from ${domain}`
							)
						);
					} else {
						console.log(
							chalk.yellow(`No credentials found for ${domain}`)
						);
					}
				} else {
					// Ask which domain to logout from
					const credentials = listCredentials();
          

					if (credentials.length === 0) {
						console.log(chalk.yellow("No credentials found"));
						return;
					}

					// Group credentials by domain
					const domains = Array.from(
						new Set(credentials.map(cred => cred.domain))
					);
					const domainChoices = domains.map(domain => {
						const accounts = credentials.filter(
							cred => cred.domain === domain
						);
						return `${domain} (${accounts.length} account${accounts.length > 1 ? "s" : ""})`;
					});

					const { selected } = await inquirer.prompt<{
						selected: string;
					}>([
						{
							type: "list",
							name: "selected",
							message: "Select domain to logout from:",
							choices: domainChoices,
						},
					]);

					// Extract domain from the selected choice
					const selectedDomain = selected.split(" ")[0];

					// Remove credentials using utility function
					removeCredentials(selectedDomain);

					// Also remove all credential files for this domain
					removeCredentialFiles(selectedDomain);

					console.log(
						chalk.green(
							`Successfully logged out from ${selectedDomain}`
						)
					);
				}
			} catch (error) {
				const err = error as Error;
				console.error(chalk.red("Error:"), err.message);
			}
		});
}
