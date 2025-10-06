import {
	MachineAgentApi,
	MachineInstancesApi,
	ProjectsApi,
} from "@nestbox-ai/admin";
import { setupAuthAndConfig } from "../../utils/api";
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import Ajv from "ajv";
import { yamlSchema } from "./yaml-schema";

export interface ApiInstances {
	agentsApi: MachineAgentApi;
	projectsApi: ProjectsApi;
	instanceApi: MachineInstancesApi;
}

/**
 * Create API instances with current authentication using setupAuthAndConfig
 */
export async function createApis(): Promise<ApiInstances> {
	const authResult = await setupAuthAndConfig();
	if (!authResult) {
		throw new Error("No authentication token found. Please log in first.");
	}

	return {
		agentsApi: new MachineAgentApi(authResult.configuration),
		projectsApi: new ProjectsApi(authResult.configuration),
		instanceApi: new MachineInstancesApi(authResult.configuration),
	};
}

const ajv = new Ajv({ strict: false });
const validate = ajv.compile(yamlSchema);

export type ManifestAgent = {
	name: string;
	description: string;
	entry: string;
	type?: "REGULAR" | "CHATBOT" | "WORKFLOW";
	inputSchema: {
		type: "object";
		properties: Record<
			string,
			{
				type: string;
				description?: string;
				default?: string | number | boolean | null;
			}
		>;
		required?: string[];
	};
};

export type ManifestFile = { agents: ManifestAgent[] };

export async function loadAgentFromYaml(
	agentName: string
): Promise<ManifestAgent | undefined> {
	const file = path.join(process.cwd(), "nestbox-agents.yaml");

	try {
		await fs.access(file);
	} catch (err: any) {
		if (err?.code === "ENOENT") return undefined;
		throw new Error(`cannot access nestbox-agents.yaml: ${err.message}`);
	}

	const raw = await fs.readFile(file, "utf8");
	const doc = yaml.load(raw) as unknown;

	if (!validate(doc)) {
		const msg = ajv.errorsText(validate.errors, { separator: "\n- " });
		throw new Error(`invalid nestbox-agents.yaml:\n- ${msg}`);
	}

	const mf = doc as ManifestFile;
	return mf.agents.find(a => a?.name === agentName);
}

export async function loadAllAgentNamesFromYaml(): Promise<string[]> {
	const file = path.join(process.cwd(), "nestbox-agents.yaml");

	try {
		await fs.access(file);
	} catch (err: any) {
		if (err?.code === "ENOENT") return [];
		throw new Error(`cannot access nestbox-agents.yaml: ${err.message}`);
	}

	const raw = await fs.readFile(file, "utf8");
	const doc = yaml.load(raw) as unknown;

	if (!validate(doc)) {
		const msg = ajv.errorsText(validate.errors, { separator: "\n- " });
		throw new Error(`invalid nestbox-agents.yaml:\n- ${msg}`);
	}

	const mf = doc as ManifestFile;
	const names = Array.isArray(mf?.agents)
		? (mf.agents.map(a => a?.name).filter(Boolean) as string[])
		: [];

	// de-duplicate by name, keep first occurrence
	const seen = new Set<string>();
	return names.filter(n => {
		if (seen.has(n)) return false;
		seen.add(n);
		return true;
	});
}
