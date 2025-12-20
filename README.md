# Nestbox CLI for managing and deploying agents

The Nestbox CLI tool is designed to facilitate development, management, and deployment of AI agents built on the Nestbox platform. It provides developers streamlined commands for authentication, deployment lifecycle management, and AI agent management.

Read more in the [Nestbox AI developers site](https://developers.nestbox.ai)

## Installation

```bash
npm install -g @nestbox-ai/cli
```

## Quick Start

1. **Login to your Nestbox platform:**
   ```bash
   nestbox login <nestbox-domain>
   ```

2. **List available projects:**
   ```bash
   nestbox project list
   ```

3. **Set default project:**
   ```bash
   nestbox project use <project-name>
   ```

4. **Deploy an agent:**
   ```bash
   nestbox agent deploy --agent <agent-name> --instance <machine-name>
   ```

## Global Options

```
nestbox [options] [command]

Options:
  -V, --version            output the version number
  -h, --help               display help for command
```

## Commands Overview

- [`login`](#login) - Login using Google SSO
- [`logout`](#logout) - Logout from Nestbox platform  
- [`project`](#project) - Manage Nestbox projects
- [`compute`](#compute) - Manage Nestbox compute instances
- [`agent`](#agent) - Manage Nestbox agents
- [`document`](#document) - Manage Nestbox documents and collections
- [`image`](#image) - Manage Nestbox images
- [`generate`](#generate) - Generate new projects and components

---

## Authentication Commands

### `login`

Login to the Nestbox platform using Google SSO.

```bash
nestbox login <nestbox-domain>
```

**Parameters:**
- `<nestbox-domain>` - The Nestbox domain to authenticate with (e.g., `app.nestbox.ai` or `localhost:3000`)

**Example:**
```bash
nestbox login app.nestbox.ai
```

After running this command, your browser will open for Google authentication. Once authenticated, paste the provided token and API URL when prompted.

### `logout`

Logout from the Nestbox platform.

```bash
nestbox logout [nestbox-domain]
```

**Parameters:**
- `[nestbox-domain]` - Optional domain to logout from. If not provided, will logout from all stored credentials.

**Example:**
```bash
nestbox logout app.nestbox.ai
```

---

## Project Management

### `project`

Manage Nestbox projects with the following subcommands:

#### `project list`

List all available projects.

```bash
nestbox project list
```

Shows all projects from the API with their names, aliases (if any), and indicates which is the current default project.

#### `project use`

Set a default project for all subsequent commands.

```bash
nestbox project use <project-name>
```

**Parameters:**
- `<project-name>` - Name of the project to set as default

**Example:**
```bash
nestbox project use my-ai-project
```

#### `project add`

Add a project with an optional alias.

```bash
nestbox project add <project-name> [alias]
```

**Parameters:**
- `<project-name>` - Name of the project to add
- `[alias]` - Optional alias for the project

**Example:**
```bash
nestbox project add my-ai-project myproj
```

---

## Compute Management

### `compute`

Manage Nestbox compute instances with the following subcommands:

#### `compute list`

List all compute instances.

```bash
nestbox compute list [options]
```

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

#### `compute create`

Create a new compute instance.

```bash
nestbox compute create <instance-name> [options]
```

**Parameters:**
- `<instance-name>` - Name for the new compute instance

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

#### `compute delete`

Delete a compute instance.

```bash
nestbox compute delete <instance-name> [options]
```

**Parameters:**
- `<instance-name>` - Name of the compute instance to delete

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)
- `--force` - Skip confirmation prompt

---

## Agent Management

### `agent`

Manage Nestbox agents with the following subcommands:

#### `agent list`

List all agents in the project.

```bash
nestbox agent list [options]
```

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

#### `agent create`

Create a new agent.

```bash
nestbox agent create [options]
```

**Options:**
- `--agent <agent>` - Agent name to create
- `--all` - Create all agents defined in nestbox-agents.yaml
- `--project <project>` - Project ID (defaults to current project)
- `--type <type>` - Agent type (e.g. CHAT, AGENT, REGULAR)
- `--description <description>` - Description of the agent
- `--instance <instance>` - Machine name
- `--inputSchema <inputSchema>` - Agent input schema

**Examples:**
```bash
# Create a single agent
nestbox agent create --agent my-agent --instance my-compute --type REGULAR

# Create all agents from YAML manifest
nestbox agent create --all --instance my-compute
```

#### `agent deploy`

Deploy an AI agent to the Nestbox platform.

```bash
nestbox agent deploy [options]
```

**Options:**
- `--agent <agent>` - Agent name to deploy
- `--all` - Deploy all agents defined in nestbox-agents.yaml
- `--prefix <prefix>` - A prefix added to beginning of the agent name
- `--description <description>` - Goal/description of the agent
- `--inputSchema <inputSchema>` - Agent input schema
- `--project <project>` - Project ID (defaults to current project)
- `--type <type>` - Agent type (e.g. CHAT, AGENT, REGULAR)
- `--entryFunction <entryFunction>` - Entry function name
- `--instance <instance>` - Machine name
- `--log` - Show detailed logs during deployment
- `--silent` - Disable automatic agent creation

**Examples:**
```bash
# Deploy a single agent
nestbox agent deploy --agent my-agent --instance my-compute

# Deploy all agents with logging
nestbox agent deploy --all --instance my-compute --log

# Deploy with custom prefix
nestbox agent deploy --agent my-agent --instance my-compute --prefix "v2-"
```

#### `agent remove`

Remove an agent from the platform.

```bash
nestbox agent remove <agent-name> [options]
```

**Parameters:**
- `<agent-name>` - Name of the agent to remove

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

---

## Document Management

### `document`

Manage Nestbox documents and collections with the following subcommands:

#### Document Collections

##### `document collection list`

List all document collections.

```bash
nestbox document collection list [options]
```

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

##### `document collection create`

Create a new document collection.

```bash
nestbox document collection create <collection-name> [options]
```

**Parameters:**
- `<collection-name>` - Name of the collection to create

**Options:**
- `--metadata <json>` - Metadata for the document collection in JSON format
- `--project <projectId>` - Project ID or name (defaults to the current project)

**Example:**
```bash
nestbox document collection create my-docs --metadata '{"category": "research"}'
```

##### `document collection get`

Get details of a specific document collection.

```bash
nestbox document collection get <collection-id> [options]
```

**Parameters:**
- `<collection-id>` - ID of the collection to retrieve

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

##### `document collection update`

Update a document collection.

```bash
nestbox document collection update <collection-id> [options]
```

**Parameters:**
- `<collection-id>` - ID of the collection to update

**Options:**
- `--name <name>` - New name of the document collection
- `--metadata <json>` - New metadata for the document collection in JSON format
- `--project <projectId>` - Project ID or name (defaults to the current project)

##### `document collection delete`

Delete a document collection.

```bash
nestbox document collection delete <collection-id> [options]
```

**Parameters:**
- `<collection-id>` - ID of the collection to delete

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

#### Documents

##### `document doc add`

Add a document to a collection.

```bash
nestbox document doc add <collection-id> <document-content> [options]
```

**Parameters:**
- `<collection-id>` - ID of the collection to add the document to
- `<document-content>` - Content of the document

**Options:**
- `--metadata <json>` - Document metadata in JSON format (optional)
- `--project <projectId>` - Project ID or name (defaults to the current project)

**Example:**
```bash
nestbox document doc add col123 "This is my document content" --metadata '{"title": "My Doc"}'
```

##### `document doc get`

Get a specific document.

```bash
nestbox document doc get <collection-id> <document-id> [options]
```

**Parameters:**
- `<collection-id>` - ID of the collection containing the document
- `<document-id>` - ID of the document to retrieve

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

##### `document doc update`

Update a document.

```bash
nestbox document doc update <collection-id> <document-id> <new-content> [options]
```

**Parameters:**
- `<collection-id>` - ID of the collection containing the document
- `<document-id>` - ID of the document to update
- `<new-content>` - New content for the document

**Options:**
- `--metadata <json>` - Updated document metadata in JSON format (optional)
- `--project <projectId>` - Project ID or name (defaults to the current project)

##### `document doc delete`

Delete a document.

```bash
nestbox document doc delete <collection-id> <document-id> [options]
```

**Parameters:**
- `<collection-id>` - ID of the collection containing the document
- `<document-id>` - ID of the document to delete

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

##### `document doc upload-file`

Upload a file as a document.

```bash
nestbox document doc upload-file <collection-id> <file-path> [options]
```

**Parameters:**
- `<collection-id>` - ID of the collection to upload the file to
- `<file-path>` - Path to the file to upload

**Options:**
- `--type <fileType>` - Type of the file (e.g., pdf, txt, doc)
- `--options <json>` - Additional options for file processing in JSON format
- `--project <projectId>` - Project ID or name (defaults to the current project)

**Example:**
```bash
nestbox document doc upload-file col123 ./document.pdf --type pdf
```

##### `document doc search`

Search for documents within collections.

```bash
nestbox document doc search <collection-id> <search-query> [options]
```

**Parameters:**
- `<collection-id>` - ID of the collection to search in
- `<search-query>` - Search query string

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)
- `--filter <json>` - Filter criteria as JSON string

---

## Image Management

### `image`

Manage Nestbox images with the following subcommands:

#### `image list`

List all available images.

```bash
nestbox image list [options]
```

**Options:**
- `--project <projectId>` - Project ID or name (defaults to the current project)

---

## Project Generation

### `generate`

Generate new projects and components with the following subcommands:

#### `generate project`

Generate a new Nestbox project from templates.

```bash
nestbox generate project <folder> [options]
```

**Parameters:**
- `<folder>` - Name of the folder to create the project in

**Options:**
- `--lang <language>` - Project language (ts|js)
- `--template <type>` - Template type (agent|chatbot)
- `--instanceName <name>` - Name of the compute instance
- `--project <projectId>` - Project ID

**Examples:**
```bash
# Generate a TypeScript agent project
nestbox generate project my-agent --lang ts --template agent

# Generate a JavaScript chatbot project
nestbox generate project my-chatbot --lang js --template chatbot --project my-project-id
```

---

## Configuration

The CLI stores authentication and configuration data in `~/.config/.nestbox/`. This includes:

- Authentication tokens for different domains
- Default project settings
- Project aliases

## Error Handling

The CLI includes automatic token refresh functionality. If your authentication token expires, the CLI will attempt to refresh it automatically. If this fails, you'll need to login again using `nestbox login`.

## Support

For more information and detailed guides, visit the [Nestbox AI developers site](https://developers.nestbox.ai).

For issues and bug reports, please visit the [GitHub repository](https://github.com/NestboxAI/nestbox-ai-cli-tools).
  