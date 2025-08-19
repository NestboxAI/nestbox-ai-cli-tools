# Getting Started with Nestbox CLI

Welcome to the Nestbox CLI! This guide will get you up and running with building, managing, and deploying AI agents on the Nestbox platform.

## Prerequisites

- Node.js 18+ installed
- A Nestbox platform account

## Installation

```bash
npm install -g @nestbox-ai/cli
```

## Quick Start

### 1. Login to Nestbox

```bash
nestbox login demo.nestbox.com
```

This opens your browser for Google SSO authentication. Once authenticated, your credentials are stored locally.

### 2. Manage Projects

List your projects:
```bash
nestbox project list
```

Switch to a project:
```bash
nestbox project use <project-name>
```

Add a new project:
```bash
nestbox project add <project-name> [alias]
```

### 3. Check Available Compute

List available compute resources:
```bash
nestbox compute list
```

Check compute status:
```bash
nestbox compute status <compute-id>
```

### 4. Generate Agent Projects

Create a new agent project from templates:
```bash
nestbox generate project <folder-name>
```

Available templates:
- `base-js` - Basic JavaScript agent
- `base-ts` - Basic TypeScript agent  
- `chatbot-js` - JavaScript chatbot agent
- `chatbot-ts` - TypeScript chatbot agent

### 5. Deploy Your Agent

From your agent directory:
```bash
nestbox agent deploy
```

List deployed agents:
```bash
nestbox agent list
```

Remove an agent:
```bash
nestbox agent remove
```

## Common Workflows

### Development Cycle
```bash
# Generate agent project
nestbox generate project my-agent

# Develop locally
cd my-agent
npm install
npm run dev

# Deploy to staging
nestbox agent deploy --env staging

# Test and validate
nestbox agent list

# Deploy to production
nestbox agent deploy --env production
```

### Managing Documents
```bash
# Upload documents for agent context
nestbox document upload ./docs/*.pdf

# List uploaded documents
nestbox document list

# Delete documents
nestbox document delete <document-id>
```

### Managing Images
```bash
# Build and push custom images
nestbox image build

# List available images
nestbox image list

# Use custom image in agent
nestbox agent deploy --image <image-id>
```

## Configuration

The CLI stores configuration in `.nestboxrc` in your home directory. You can also use project-specific configuration by creating a `nestbox.config.json` file:

```json
{
  "project": "your-project-id",
  "defaultCompute": "your-compute-id",
  "environment": "staging"
}
```

## Help & Documentation

Get help for any command:
```bash
nestbox --help
nestbox agent --help
nestbox project --help
```

## Next Steps

- Check out the [Nestbox AI developers site](https://developers.nestbox.ai) for detailed documentation
- Explore the example agents in the templates directory
- Join our developer community for support and best practices

Happy building! 🚀
