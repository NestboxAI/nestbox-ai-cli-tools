import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerAgentCommands } from "../src/commands/agent";
import { selectTargetAgent } from "../src/commands/agent/deploy";

vi.unmock("../src/utils/agent");
import { getAgentExcludePatterns } from "../src/utils/agent";

describe("Agent Commands", () => {
	let program: Command;

	beforeEach(() => {
		program = new Command();
		vi.clearAllMocks();
	});

	describe("registerAgentCommands", () => {
		it("should register agent command group", () => {
			registerAgentCommands(program);

			const commands = program.commands;
			const agentCommand = commands.find(cmd => cmd.name() === "agent");

			expect(agentCommand).toBeDefined();
			expect(agentCommand?.description()).toBe("Manage Nestbox agents");
		});

		it("should register agent list subcommand", () => {
			registerAgentCommands(program);

			const agentCommand = program.commands.find(
				cmd => cmd.name() === "agent"
			);
			const subCommands = agentCommand?.commands || [];
			const listCommand = subCommands.find(cmd => cmd.name() === "list");

			expect(listCommand).toBeDefined();
			expect(listCommand?.description()).toBe(
				"List all AI agents associated with the authenticated user"
			);

			// Check options
			const options = listCommand?.options || [];
			const projectOption = options.find(opt => opt.long === "--project");
			expect(projectOption).toBeDefined();
			expect(projectOption?.description).toBe(
				"Project name (defaults to the current project)"
			);
		});

		it("should register agent remove subcommand", () => {
			registerAgentCommands(program);

			const agentCommand = program.commands.find(
				cmd => cmd.name() === "agent"
			);
			const subCommands = agentCommand?.commands || [];
			const removeCommand = subCommands.find(
				cmd => cmd.name() === "remove"
			);

			expect(removeCommand).toBeDefined();
			expect(removeCommand?.description()).toBe("Remove an AI agent");

			// Check options
			const options = removeCommand?.options || [];
			const agentOption = options.find(opt => opt.long === "--agent");
			const projectOption = options.find(opt => opt.long === "--project");

			expect(agentOption).toBeDefined();
			expect(projectOption).toBeDefined();
		});

		it("should register agent deploy subcommand", () => {
			registerAgentCommands(program);

			const agentCommand = program.commands.find(
				cmd => cmd.name() === "agent"
			);
			const subCommands = agentCommand?.commands || [];
			const deployCommand = subCommands.find(
				cmd => cmd.name() === "deploy"
			);

			expect(deployCommand).toBeDefined();
			expect(deployCommand?.description()).toBe(
				"Deploy an AI agent to the Nestbox platform"
			);

			// Check options
			const options = deployCommand?.options || [];
			const projectOption = options.find(opt => opt.long === "--project");
			const agentOption = options.find(opt => opt.long === "--agent");
			const instanceOption = options.find(
				opt => opt.long === "--instance"
			);

			expect(projectOption).toBeDefined();
			expect(agentOption).toBeDefined();
			expect(instanceOption).toBeDefined();
		});

		it("should register agent create subcommand", () => {
			registerAgentCommands(program);

			const agentCommand = program.commands.find(
				cmd => cmd.name() === "agent"
			);
			const subCommands = agentCommand?.commands || [];
			const createCommand = subCommands.find(
				cmd => cmd.name() === "create"
			);

			expect(createCommand).toBeDefined();
			expect(createCommand?.description()).toBe(
				"Create an agent with direct arguments or YAML."
			);

			// Check that it has optional arguments (in command name: "create [firstArg] [secondArg]")
			expect(createCommand?.name()).toBe("create");

			// Check options
			const options = createCommand?.options || [];
			const projectOption = options.find(opt => opt.long === "--project");

			expect(projectOption).toBeDefined();
		});

		it("should have all expected agent subcommands", () => {
			registerAgentCommands(program);

			const agentCommand = program.commands.find(
				cmd => cmd.name() === "agent"
			);
			const subCommandNames =
				agentCommand?.commands.map(cmd => cmd.name()) || [];

			expect(subCommandNames).toContain("list");
			expect(subCommandNames).toContain("remove");
			expect(subCommandNames).toContain("deploy");
			expect(subCommandNames).toContain("create");
			expect(subCommandNames).toHaveLength(4);
		});

		it("should have proper action functions for all subcommands", () => {
			registerAgentCommands(program);

			const agentCommand = program.commands.find(
				cmd => cmd.name() === "agent"
			);
			const subCommands = agentCommand?.commands || [];

			subCommands.forEach(cmd => {
				expect(typeof cmd.action).toBe("function");
			});
		});
	});
});


describe("Agent Config Utilities", () => {
	it("should return default exclude patterns when config is missing", () => {
		expect(getAgentExcludePatterns(null)).toEqual(["node_modules"]);
	});

	it("should merge config excludes with defaults and remove duplicates", () => {
		const config = {
			agents: {
				exclude: [".git", "node_modules", "dist"],
			},
		};

		expect(getAgentExcludePatterns(config)).toEqual([
			"node_modules",
			".git",
			"dist",
		]);
	});

	it("should ignore non-string exclude entries", () => {
		const config = {
			agents: {
				exclude: [".git", "", 123, null],
			},
		};

		expect(getAgentExcludePatterns(config)).toEqual([
			"node_modules",
			".git",
		]);
	});

	it("should select deploy target agent by machine instance id when names collide", () => {
		const selected = selectTargetAgent(
			[
				{ id: 1, agentName: "simple-claude-agent", machineInstanceId: 11 },
				{ id: 2, agentName: "simple-claude-agent", machineInstanceId: 12 },
			],
			"simple-claude-agent",
			{ id: 12 }
		);

		expect(selected?.id).toBe(2);
	});

	it("should return undefined when duplicate agents exist but none match target instance", () => {
		const selected = selectTargetAgent(
			[
				{ id: 1, agentName: "simple-claude-agent", machineInstanceId: 11 },
				{ id: 2, agentName: "simple-claude-agent", machineInstanceId: 12 },
			],
			"simple-claude-agent",
			{ id: 13 }
		);

		expect(selected).toBeUndefined();
	});

	it("should not select a single name match from a different instance", () => {
		const selected = selectTargetAgent(
			[
				{ id: 1, agentName: "simple-claude-agent", machineInstanceId: 11 },
			],
			"simple-claude-agent",
			{ id: 12, instanceName: "ts-agent-claude-14" }
		);

		expect(selected).toBeUndefined();
	});
});
