# Nestbox CLI for managing and deploying agents

The Nestbox CLI tool is designed to facilitate development, management, and deployment of AI agents built on the Nestbox platform. It provides developers streamlined commands for authentication, deployment lifecycle management, AI agent management, document processing, and AI-assisted configuration generation.

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
- [`doc-proc`](#doc-proc) - Document processing pipeline management
- [`generate`](#generate) - AI-assisted configuration and project generation

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

## Document Processing

### `doc-proc`

Manage document processing pipelines — upload documents, run processing jobs, manage profiles, run evaluations, and configure webhooks.

**Global options** (available on all `doc-proc` subcommands):
- `--project <projectId>` - Project ID or name (defaults to current project)
- `--instance <instanceId>` - Document processing instance ID
- `--json` - Output raw JSON instead of formatted tables

---

### Profile Management

A *profile* is a YAML configuration file that controls how documents are processed (OCR settings, chunking strategy, GraphRAG indexing, etc.).

#### `doc-proc profile init`

Scaffold a profile YAML template to the local filesystem.

```bash
nestbox doc-proc profile init [options]
```

**Options:**
- `-o, --output <path>` - Output file path (default: `./profile.yaml`)
- `-f, --force` - Overwrite existing file

**Example:**
```bash
nestbox doc-proc profile init -o ./my-profile.yaml
```

#### `doc-proc profile create`

Register a profile from a YAML file with the processing instance.

```bash
nestbox doc-proc profile create --file <path> [options]
```

**Options:**
- `-f, --file <path>` - Path to profile YAML file (required)
- `-n, --name <name>` - Override the profile name from the file
- `--project <projectId>` - Project ID or name
- `--instance <instanceId>` - Processing instance ID
- `--json` - Output raw JSON

**Example:**
```bash
nestbox doc-proc profile create --file ./my-profile.yaml --name "OCR + GraphRAG"
```

#### `doc-proc profile list`

List all profiles registered with the instance.

```bash
nestbox doc-proc profile list [options]
```

**Options:**
- `--page <page>` - Page number (default: `1`)
- `--limit <limit>` - Page size (default: `20`)

#### `doc-proc profile show`

Show full details of a profile by ID.

```bash
nestbox doc-proc profile show --profile <profileId> [options]
```

**Options:**
- `--profile <profileId>` - Profile ID (required)

#### `doc-proc profile validate`

Validate a profile YAML file against the schema without registering it.

```bash
nestbox doc-proc profile validate --file <path> [options]
```

**Options:**
- `-f, --file <path>` - Path to profile YAML file (required)

#### `doc-proc profile schema`

Print the full profile JSON Schema for reference.

```bash
nestbox doc-proc profile schema [options]
```

---

### Document Management

#### `doc-proc document create`

Upload a file and create a document processing job.

```bash
nestbox doc-proc document create --input <path> [options]
```

**Options:**
- `--input <path>` - Document file path (required)
- `--profile <profileId>` - Processing profile ID
- `--stages <stages>` - Comma-separated stage override (e.g. `ocr,chunking`)
- `--priority <priority>` - Job priority: `low`, `normal`, or `high`

**Example:**
```bash
nestbox doc-proc document create --input ./contract.pdf --profile prof-abc123
```

#### `doc-proc document list`

List all processed documents.

```bash
nestbox doc-proc document list [options]
```

**Options:**
- `--page <page>` - Page number (default: `1`)
- `--limit <limit>` - Page size (default: `20`)

#### `doc-proc document show`

Show details of a specific processed document.

```bash
nestbox doc-proc document show --document <documentId> [options]
```

**Options:**
- `--document <documentId>` - Document ID (required)

#### `doc-proc document artifacts`

Download all artifacts for a document as a zip file (GraphRAG output, chunks, etc.).

```bash
nestbox doc-proc document artifacts --document <documentId> [options]
```

**Options:**
- `--document <documentId>` - Document ID (required)
- `-o, --output <path>` - Output zip path (default: `./document-artifacts.zip`)

**Example:**
```bash
nestbox doc-proc document artifacts --document doc-abc123 -o ./artifacts.zip
```

---

### Job Monitoring

#### `doc-proc job list`

List document processing jobs.

```bash
nestbox doc-proc job list [options]
```

**Options:**
- `--state <state>` - Filter by job state (e.g. `pending`, `running`, `completed`, `failed`)
- `--page <page>` - Page number (default: `1`)
- `--limit <limit>` - Page size (default: `20`)

#### `doc-proc job status`

Get the status of a specific job.

```bash
nestbox doc-proc job status --job <jobId> [options]
```

**Options:**
- `--job <jobId>` - Job ID (required)
- `--full` - Fetch full job details instead of lightweight status

**Example:**
```bash
nestbox doc-proc job status --job job-xyz789 --full
```

---

### Evaluations

Evaluations run a set of Q&A test cases against a processed document to measure extraction quality.

#### `doc-proc eval init`

Scaffold an eval YAML template.

```bash
nestbox doc-proc eval init [options]
```

**Options:**
- `-o, --output <path>` - Output file path (default: `./eval.yaml`)
- `-f, --force` - Overwrite existing file

**Example eval.yaml:**
```yaml
testCases:
  - id: q1
    question: "What are the payment terms?"
    expectedAnswer: "Net 30"
```

#### `doc-proc eval run`

Run an evaluation against a document.

```bash
nestbox doc-proc eval run --document <documentId> --file <path> [options]
```

**Options:**
- `--document <documentId>` - Document ID (required)
- `-f, --file <path>` - Path to eval YAML file (required)

**Example:**
```bash
nestbox doc-proc eval run --document doc-abc123 --file ./eval.yaml
```

#### `doc-proc eval validate`

Validate an eval YAML file against the schema without running it.

```bash
nestbox doc-proc eval validate --document <documentId> --file <path> [options]
```

#### `doc-proc eval list`

List all evaluations for a document.

```bash
nestbox doc-proc eval list --document <documentId> [options]
```

**Options:**
- `--document <documentId>` - Document ID (required)
- `--page <page>` - Page number (default: `1`)
- `--limit <limit>` - Page size (default: `20`)

#### `doc-proc eval show`

Get full details of a specific evaluation.

```bash
nestbox doc-proc eval show --document <documentId> --eval <evalId> [options]
```

**Options:**
- `--document <documentId>` - Document ID (required)
- `--eval <evalId>` - Evaluation ID (required)

---

### Batch Queries

Batch queries let you run multiple questions against a processed document in one request.

#### `doc-proc query init`

Scaffold a batch query YAML template.

```bash
nestbox doc-proc query init [options]
```

**Options:**
- `-o, --output <path>` - Output file path (default: `./query.yaml`)
- `-f, --force` - Overwrite existing file

**Example query.yaml:**
```yaml
queries:
  - id: payment_terms
    question: "What are the payment terms?"
    mode: local
```

#### `doc-proc query create`

Submit a batch query from a YAML file.

```bash
nestbox doc-proc query create --file <path> [options]
```

**Options:**
- `-f, --file <path>` - YAML file path (required)

#### `doc-proc query validate`

Validate a query YAML file without submitting it.

```bash
nestbox doc-proc query validate --file <path> [options]
```

#### `doc-proc query list`

List all batch queries.

```bash
nestbox doc-proc query list [options]
```

**Options:**
- `--page <page>` - Page number (default: `1`)
- `--limit <limit>` - Page size (default: `20`)

#### `doc-proc query show`

Get details of a specific batch query.

```bash
nestbox doc-proc query show --query <queryId> [options]
```

**Options:**
- `--query <queryId>` - Query ID (required)

---

### Webhooks

#### `doc-proc webhook create`

Register a webhook to receive processing event notifications.

```bash
nestbox doc-proc webhook create --url <url> [options]
```

**Options:**
- `--url <url>` - Webhook URL (required)
- `--secret <secret>` - HMAC signing secret for payload verification
- `--event <event...>` - One or more event names to subscribe to

**Example:**
```bash
nestbox doc-proc webhook create --url https://my-app.com/hooks/nestbox --event job.completed job.failed
```

#### `doc-proc webhook list`

List all registered webhooks.

```bash
nestbox doc-proc webhook list [options]
```

#### `doc-proc webhook show`

Get details of a specific webhook.

```bash
nestbox doc-proc webhook show --webhook <webhookId> [options]
```

#### `doc-proc webhook update`

Update a webhook's configuration.

```bash
nestbox doc-proc webhook update --webhook <webhookId> [options]
```

**Options:**
- `--webhook <webhookId>` - Webhook ID (required)
- `--url <url>` - New webhook URL
- `--secret <secret>` - New signing secret
- `--event <event...>` - New event subscriptions
- `--active <true|false>` - Enable or disable the webhook

#### `doc-proc webhook delete`

Delete a webhook.

```bash
nestbox doc-proc webhook delete --webhook <webhookId> [options]
```

**Options:**
- `--webhook <webhookId>` - Webhook ID (required)

---

### Health Check

#### `doc-proc health`

Check the health of the document processing API.

```bash
nestbox doc-proc health [options]
```

---

## Generate

### `generate`

AI-assisted generation of configuration files and project scaffolds. Uses Claude to generate validated YAML configurations from plain-English instruction files.

---

### `generate project`

Generate a new Nestbox project from templates.

```bash
nestbox generate project <folder> [options]
```

**Parameters:**
- `<folder>` - Name of the folder to create the project in

**Options:**
- `--lang <language>` - Project language (`ts`|`js`)
- `--template <type>` - Template type (`agent`|`chatbot`)
- `--instanceName <name>` - Name of the compute instance
- `--project <projectId>` - Project ID

**Examples:**
```bash
# Generate a TypeScript agent project
nestbox generate project my-agent --lang ts --template agent

# Generate a JavaScript chatbot project
nestbox generate project my-chatbot --lang js --template chatbot
```

---

### `generate doc-proc`

Generate a document processing pipeline configuration (`config.yaml` and `eval.yaml`) from a plain-English instructions file using Claude AI.

The agent reads your instructions, writes both files, validates each against their schemas, and iterates automatically until both pass validation.

```bash
nestbox generate doc-proc --file <path> --output <dir> --anthropicApiKey <key> [options]
```

**Required options:**
- `-f, --file <path>` - Path to a Markdown file describing what the pipeline should do
- `-o, --output <dir>` - Output directory where `config.yaml` and `eval.yaml` will be written
- `--anthropicApiKey <key>` - Anthropic API key (or set `ANTHROPIC_API_KEY` env var)

**Optional options:**
- `--model <model>` - Claude model ID (default: `claude-sonnet-4-6`)
- `--maxIterations <n>` - Maximum agent iterations before giving up (default: `8`)

**Output files:**
- `config.yaml` — document processing pipeline configuration
- `eval.yaml` — evaluation test cases for the pipeline

**Example:**
```bash
# Using a flag for the API key
nestbox generate doc-proc \
  --file ./instructions.md \
  --output ./pipeline \
  --anthropicApiKey sk-ant-...

# Using the environment variable
export ANTHROPIC_API_KEY=sk-ant-...
nestbox generate doc-proc --file ./instructions.md --output ./pipeline
```

**Example instructions file (`instructions.md`):**
```markdown
# Contract Processing Pipeline

Process PDF contracts. Extract text with OCR using rapidocr.
Chunk with the docling_hybrid strategy, max 1200 tokens, 200 overlap.
Enable GraphRAG indexing.

Eval test cases:
- "What are the payment terms?" → expected answer should mention Net 30 or similar
- "Who are the parties to this agreement?"
```

---

### `generate report-composer`

Generate a GraphRAG report composer configuration (`report.yaml`) from a plain-English instructions file using Claude AI.

The agent reads your instructions, writes the report configuration, validates it against the schema (v2.2), and iterates automatically until it passes — it will not finish until the file is valid.

```bash
nestbox generate report-composer --file <path> --output <dir> --anthropicApiKey <key> [options]
```

**Required options:**
- `-f, --file <path>` - Path to a Markdown file describing the report to generate
- `-o, --output <dir>` - Output directory where `report.yaml` will be written
- `--anthropicApiKey <key>` - Anthropic API key (or set `ANTHROPIC_API_KEY` env var)

**Optional options:**
- `--model <model>` - Claude model ID (default: `claude-sonnet-4-6`)
- `--maxIterations <n>` - Maximum agent iterations before giving up (default: `5`)

**Output files:**
- `report.yaml` — report composer configuration (schema version 2.2)

**Example:**
```bash
nestbox generate report-composer \
  --file ./report-instructions.md \
  --output ~/Downloads/my-report \
  --anthropicApiKey sk-ant-...
```

**Example instructions file (`report-instructions.md`):**
```markdown
# Quarterly Board Report

Analyze the board deck PDF for Q4 2025.

Extract:
- Total ARR and net retention rate
- Net new ARR broken down by new business vs expansion
- Top 3 customer deals closed in the quarter
- Key risks and mitigation plans

The document is stored at repo:doc-abc123. Use ${OPENAI_API_KEY} for GraphRAG search
and ${LLAMAINDEX_API_KEY} for the LlamaIndex agent.

Include two guardrails: one to check all numbers have citations, one to detect fabricated data.
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
