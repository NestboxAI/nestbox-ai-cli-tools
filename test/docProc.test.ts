import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerDocProcCommands } from "../src/commands/docProc";

describe("DocProc Commands", () => {
	let program: Command;

	beforeEach(() => {
		program = new Command();
		vi.clearAllMocks();
	});

	describe("registerDocProcCommands", () => {
		it("should register doc-proc command group", () => {
			registerDocProcCommands(program);

			const commands = program.commands;
			const docProcCommand = commands.find(
				cmd => cmd.name() === "doc-proc"
			);

			expect(docProcCommand).toBeDefined();
			expect(docProcCommand?.description()).toBe(
				"Document processing commands"
			);
		});

		it("should have --json and --verbose options on doc-proc command", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const options = docProcCommand?.options || [];
			const jsonOption = options.find(opt => opt.long === "--json");
			const verboseOption = options.find(
				opt => opt.long === "--verbose"
			);

			expect(jsonOption).toBeDefined();
			expect(verboseOption).toBeDefined();
		});

		it("should have all expected subcommand groups", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const subCommandNames =
				docProcCommand?.commands.map(cmd => cmd.name()) || [];

			expect(subCommandNames).toContain("profile");
			expect(subCommandNames).toContain("document");
			expect(subCommandNames).toContain("job");
			expect(subCommandNames).toContain("eval");
			expect(subCommandNames).toContain("query");
			expect(subCommandNames).toContain("webhook");
			expect(subCommandNames).toContain("health");
			expect(subCommandNames).toHaveLength(7);
		});
	});

	describe("profile subcommands", () => {
		it("should register profile subcommand group", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const profileCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "profile"
			);

			expect(profileCommand).toBeDefined();
			expect(profileCommand?.description()).toBe(
				"Manage document-processing profiles"
			);
		});

		it("should have all expected profile subcommands", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const profileCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "profile"
			);
			const subCommandNames =
				profileCommand?.commands.map(cmd => cmd.name()) || [];

			expect(subCommandNames).toContain("init");
			expect(subCommandNames).toContain("create");
			expect(subCommandNames).toContain("validate");
			expect(subCommandNames).toContain("list");
			expect(subCommandNames).toContain("show");
			expect(subCommandNames).toContain("schema");
			expect(subCommandNames).toHaveLength(6);
		});

		it("should register profile init subcommand with correct options", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const profileCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "profile"
			);
			const initCommand = profileCommand?.commands.find(
				cmd => cmd.name() === "init"
			);

			expect(initCommand).toBeDefined();
			expect(initCommand?.description()).toBe(
				"Create a profile YAML template"
			);

			const options = initCommand?.options || [];
			const outputOption = options.find(opt => opt.long === "--output");
			const forceOption = options.find(opt => opt.long === "--force");

			expect(outputOption).toBeDefined();
			expect(forceOption).toBeDefined();
		});

		it("should register profile create subcommand with correct options", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const profileCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "profile"
			);
			const createCommand = profileCommand?.commands.find(
				cmd => cmd.name() === "create"
			);

			expect(createCommand).toBeDefined();
			expect(createCommand?.description()).toBe(
				"Create/register a processing profile from YAML file"
			);

			const options = createCommand?.options || [];
			const fileOption = options.find(opt => opt.long === "--file");
			const nameOption = options.find(opt => opt.long === "--name");
			const projectOption = options.find(
				opt => opt.long === "--project"
			);
			const instanceOption = options.find(
				opt => opt.long === "--instance"
			);

			expect(fileOption).toBeDefined();
			expect(nameOption).toBeDefined();
			expect(projectOption).toBeDefined();
			expect(instanceOption).toBeDefined();
		});

		it("should register profile list subcommand with pagination options", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const profileCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "profile"
			);
			const listCommand = profileCommand?.commands.find(
				cmd => cmd.name() === "list"
			);

			expect(listCommand).toBeDefined();
			expect(listCommand?.description()).toBe(
				"List processing profiles"
			);

			const options = listCommand?.options || [];
			const pageOption = options.find(opt => opt.long === "--page");
			const limitOption = options.find(opt => opt.long === "--limit");

			expect(pageOption).toBeDefined();
			expect(limitOption).toBeDefined();
		});
	});

	describe("document subcommands", () => {
		it("should register document subcommand group", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const documentCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "document"
			);

			expect(documentCommand).toBeDefined();
			expect(documentCommand?.description()).toBe(
				"Create and inspect document-processing documents"
			);
		});

		it("should have all expected document subcommands", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const documentCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "document"
			);
			const subCommandNames =
				documentCommand?.commands.map(cmd => cmd.name()) || [];

			expect(subCommandNames).toContain("create");
			expect(subCommandNames).toContain("list");
			expect(subCommandNames).toContain("show");
			expect(subCommandNames).toContain("artifacts");
			expect(subCommandNames).toHaveLength(4);
		});

		it("should register document create subcommand with correct options", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const documentCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "document"
			);
			const createCommand = documentCommand?.commands.find(
				cmd => cmd.name() === "create"
			);

			expect(createCommand).toBeDefined();
			expect(createCommand?.description()).toBe(
				"Create a document processing job by uploading a file"
			);

			const options = createCommand?.options || [];
			const inputOption = options.find(opt => opt.long === "--input");
			const profileOption = options.find(
				opt => opt.long === "--profile"
			);
			const stagesOption = options.find(opt => opt.long === "--stages");
			const priorityOption = options.find(
				opt => opt.long === "--priority"
			);

			expect(inputOption).toBeDefined();
			expect(profileOption).toBeDefined();
			expect(stagesOption).toBeDefined();
			expect(priorityOption).toBeDefined();
		});

		it("should register document artifacts subcommand with output option", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const documentCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "document"
			);
			const artifactsCommand = documentCommand?.commands.find(
				cmd => cmd.name() === "artifacts"
			);

			expect(artifactsCommand).toBeDefined();
			expect(artifactsCommand?.description()).toBe(
				"Download document artifacts as zip"
			);

			const options = artifactsCommand?.options || [];
			const documentOption = options.find(
				opt => opt.long === "--document"
			);
			const outputOption = options.find(opt => opt.long === "--output");

			expect(documentOption).toBeDefined();
			expect(outputOption).toBeDefined();
		});
	});

	describe("job subcommands", () => {
		it("should register job subcommand group", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const jobCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "job"
			);

			expect(jobCommand).toBeDefined();
			expect(jobCommand?.description()).toBe(
				"Monitor document-processing jobs"
			);
		});

		it("should have all expected job subcommands", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const jobCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "job"
			);
			const subCommandNames =
				jobCommand?.commands.map(cmd => cmd.name()) || [];

			expect(subCommandNames).toContain("list");
			expect(subCommandNames).toContain("status");
			expect(subCommandNames).toHaveLength(2);
		});

		it("should register job list subcommand with state filter option", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const jobCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "job"
			);
			const listCommand = jobCommand?.commands.find(
				cmd => cmd.name() === "list"
			);

			expect(listCommand).toBeDefined();
			expect(listCommand?.description()).toBe(
				"List document-processing jobs"
			);

			const options = listCommand?.options || [];
			const stateOption = options.find(opt => opt.long === "--state");

			expect(stateOption).toBeDefined();
		});

		it("should register job status subcommand with full option", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const jobCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "job"
			);
			const statusCommand = jobCommand?.commands.find(
				cmd => cmd.name() === "status"
			);

			expect(statusCommand).toBeDefined();
			expect(statusCommand?.description()).toBe(
				"Get job status by ID"
			);

			const options = statusCommand?.options || [];
			const jobOption = options.find(opt => opt.long === "--job");
			const fullOption = options.find(opt => opt.long === "--full");

			expect(jobOption).toBeDefined();
			expect(fullOption).toBeDefined();
		});
	});

	describe("eval subcommands", () => {
		it("should register eval subcommand group", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const evalCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "eval"
			);

			expect(evalCommand).toBeDefined();
			expect(evalCommand?.description()).toBe(
				"Manage document evaluations"
			);
		});

		it("should have all expected eval subcommands", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const evalCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "eval"
			);
			const subCommandNames =
				evalCommand?.commands.map(cmd => cmd.name()) || [];

			expect(subCommandNames).toContain("init");
			expect(subCommandNames).toContain("run");
			expect(subCommandNames).toContain("validate");
			expect(subCommandNames).toContain("list");
			expect(subCommandNames).toContain("show");
			expect(subCommandNames).toHaveLength(5);
		});

		it("should register eval run subcommand with correct options", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const evalCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "eval"
			);
			const runCommand = evalCommand?.commands.find(
				cmd => cmd.name() === "run"
			);

			expect(runCommand).toBeDefined();
			expect(runCommand?.description()).toBe(
				"Create evaluation from YAML file"
			);

			const options = runCommand?.options || [];
			const documentOption = options.find(
				opt => opt.long === "--document"
			);
			const fileOption = options.find(opt => opt.long === "--file");

			expect(documentOption).toBeDefined();
			expect(fileOption).toBeDefined();
		});
	});

	describe("query subcommands", () => {
		it("should register query subcommand group", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const queryCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "query"
			);

			expect(queryCommand).toBeDefined();
			expect(queryCommand?.description()).toBe(
				"Manage batch query YAML submissions"
			);
		});

		it("should have all expected query subcommands", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const queryCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "query"
			);
			const subCommandNames =
				queryCommand?.commands.map(cmd => cmd.name()) || [];

			expect(subCommandNames).toContain("init");
			expect(subCommandNames).toContain("create");
			expect(subCommandNames).toContain("validate");
			expect(subCommandNames).toContain("list");
			expect(subCommandNames).toContain("show");
			expect(subCommandNames).toHaveLength(5);
		});

		it("should register query create subcommand with file option", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const queryCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "query"
			);
			const createCommand = queryCommand?.commands.find(
				cmd => cmd.name() === "create"
			);

			expect(createCommand).toBeDefined();
			expect(createCommand?.description()).toBe(
				"Create a batch query from YAML file"
			);

			const options = createCommand?.options || [];
			const fileOption = options.find(opt => opt.long === "--file");

			expect(fileOption).toBeDefined();
		});
	});

	describe("webhook subcommands", () => {
		it("should register webhook subcommand group", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const webhookCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "webhook"
			);

			expect(webhookCommand).toBeDefined();
			expect(webhookCommand?.description()).toBe(
				"Manage document-processing webhooks"
			);
		});

		it("should have all expected webhook subcommands", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const webhookCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "webhook"
			);
			const subCommandNames =
				webhookCommand?.commands.map(cmd => cmd.name()) || [];

			expect(subCommandNames).toContain("create");
			expect(subCommandNames).toContain("list");
			expect(subCommandNames).toContain("show");
			expect(subCommandNames).toContain("update");
			expect(subCommandNames).toContain("delete");
			expect(subCommandNames).toHaveLength(5);
		});

		it("should register webhook create subcommand with correct options", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const webhookCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "webhook"
			);
			const createCommand = webhookCommand?.commands.find(
				cmd => cmd.name() === "create"
			);

			expect(createCommand).toBeDefined();
			expect(createCommand?.description()).toBe(
				"Create webhook for receiving notifications"
			);

			const options = createCommand?.options || [];
			const urlOption = options.find(opt => opt.long === "--url");
			const secretOption = options.find(opt => opt.long === "--secret");
			const eventOption = options.find(opt => opt.long === "--event");

			expect(urlOption).toBeDefined();
			expect(secretOption).toBeDefined();
			expect(eventOption).toBeDefined();
		});

		it("should register webhook update subcommand with active option", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const webhookCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "webhook"
			);
			const updateCommand = webhookCommand?.commands.find(
				cmd => cmd.name() === "update"
			);

			expect(updateCommand).toBeDefined();
			expect(updateCommand?.description()).toBe(
				"Update webhook configuration"
			);

			const options = updateCommand?.options || [];
			const webhookOption = options.find(
				opt => opt.long === "--webhook"
			);
			const activeOption = options.find(opt => opt.long === "--active");

			expect(webhookOption).toBeDefined();
			expect(activeOption).toBeDefined();
		});

		it("should register webhook delete subcommand", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const webhookCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "webhook"
			);
			const deleteCommand = webhookCommand?.commands.find(
				cmd => cmd.name() === "delete"
			);

			expect(deleteCommand).toBeDefined();
			expect(deleteCommand?.description()).toBe("Delete a webhook");

			const options = deleteCommand?.options || [];
			const webhookOption = options.find(
				opt => opt.long === "--webhook"
			);

			expect(webhookOption).toBeDefined();
		});
	});

	describe("health subcommand", () => {
		it("should register health subcommand directly on doc-proc", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const healthCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "health"
			);

			expect(healthCommand).toBeDefined();
			expect(healthCommand?.description()).toBe(
				"Get document processing API client health"
			);
		});

		it("should have project and instance options on health command", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const healthCommand = docProcCommand?.commands.find(
				cmd => cmd.name() === "health"
			);

			const options = healthCommand?.options || [];
			const projectOption = options.find(
				opt => opt.long === "--project"
			);
			const instanceOption = options.find(
				opt => opt.long === "--instance"
			);
			const jsonOption = options.find(opt => opt.long === "--json");

			expect(projectOption).toBeDefined();
			expect(instanceOption).toBeDefined();
			expect(jsonOption).toBeDefined();
		});
	});

	describe("action functions", () => {
		it("should have proper action functions for all subcommand groups", () => {
			registerDocProcCommands(program);

			const docProcCommand = program.commands.find(
				cmd => cmd.name() === "doc-proc"
			);
			const subCommands = docProcCommand?.commands || [];

			subCommands.forEach(cmd => {
				// Nested groups (profile, document, job, eval, query, webhook) have sub-subcommands
				if (cmd.commands.length > 0) {
					cmd.commands.forEach(subCmd => {
						expect(typeof subCmd.action).toBe("function");
					});
				} else {
					// health is a direct command
					expect(typeof cmd.action).toBe("function");
				}
			});
		});
	});
});
