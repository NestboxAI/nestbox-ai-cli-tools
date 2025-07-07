/**
 * Type definition for Agent YAML configuration file
 */

/**
 * Represents a parameter for an agent in the YAML configuration
 */
export interface AgentParameter {
  /**
   * Name of the parameter
   */
  name: string;
  
  /**
   * Description of the parameter
   */
  description: string;
  
  /**
   * Default value for the parameter
   */
  default?: any;
  
  /**
   * Default value as a string (used internally)
   */
  default_value?: string;
  
  /**
   * Whether this parameter is configurable by users
   * @default true
   */
  isUserParam?: boolean;
}

/**
 * Represents a single agent definition in the YAML configuration
 */
export interface AgentDefinition {
  /**
   * Name of the agent (required)
   */
  name: string;
  
  /**
   * Description of the agent's purpose
   * @default `AI agent for ${name}`
   */
  goal?: string;
  
  /**
   * Agent type ("CHAT" or "AGENT")
   * CHAT creates a chatbot, AGENT creates a regular agent
   * @default "CHAT"
   */
  type?: string;
  
  /**
   * Machine manifest ID for the agent
   * @default "llamaindex-agent"
   */
  machineManifestId?: string;
  
  /**
   * Instance IP address
   * @default "http://34.121.124.21"
   */
  instanceIP?: string;
  
  /**
   * Name of the machine
   * @default "agent-instance"
   */
  machineName?: string;
  
  /**
   * Machine instance ID
   * @default 17
   */
  machineInstanceId?: number;
  
  /**
   * Name of the instance
   */
  instanceName?: string;
  
  /**
   * Model base ID
   * @default ""
   */
  modelBaseId?: string;
  
  /**
   * Agent parameters
   */
  parameters?: AgentParameter[];
}

/**
 * Overall structure of the YAML configuration file
 */
export interface AgentYamlConfig {
  /**
   * Array of agent definitions
   */
  agents: AgentDefinition[];
}
