# Nestbox CLI for managing and deploying agents
The Nestbox CLI tool is designed to facilitate development, management, and deployment of AI agents built on the Nestbox platform. It provides developers streamlined commands for authentication, deployment lifecycle management, and AI agent management.

Read more in the [Nestbox AI developers site](https://developers.nestbox.ai)

## Installation
```
npm install -g @nestbox-ai/cli
```

# Authentication
```
nestbox login <nestbox-domain>
```

# Usage
```
 nestbox --help
Usage: nestbox [options] [command]

CLI tool for the Nestbox AI platform

Options:
  -V, --version            output the version number
  -h, --help               display help for command

Commands:
  login <nestbox-domain>   Login using Google SSO
  logout [nestbox-domain]  Logout from Nestbox platform
  project                  Manage Nestbox projects
  compute                  Manage Nestbox computes
  agent                    Manage Nestbox agents
  document                 Manage Nestbox documents
  image                    Manage Nestbox images
  help [command]           display help for command
  ```