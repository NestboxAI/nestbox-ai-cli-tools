import { vi } from 'vitest';

// Mock external dependencies that are commonly used across all test files
export const setupCommonMocks = () => {
  // Mock utils/error
  vi.mock('../src/utils/error', () => ({
    withTokenRefresh: vi.fn(),
    handle401Error: vi.fn()
  }));

  // Mock utils/auth
  vi.mock('../src/utils/auth', () => ({
    getAuthToken: vi.fn().mockReturnValue({
      token: 'mock-token',
      serverUrl: 'http://localhost:3000'
    }),
    listCredentials: vi.fn(),
    removeCredentials: vi.fn()
  }));

  // Mock @nestbox-ai/admin
  vi.mock('@nestbox-ai/admin', () => ({
    Configuration: vi.fn(),
    AuthApi: vi.fn(),
    ProjectsApi: vi.fn(),
    MachineAgentApi: vi.fn(),
    MachineInstancesApi: vi.fn(),
    MiscellaneousApi: vi.fn(),
    DocumentsApi: vi.fn(),
    OAuthLoginRequestDTOTypeEnum: {}
  }));

  // Mock utils/project
  vi.mock('../src/utils/project', () => ({
    resolveProject: vi.fn()
  }));

  // Mock utils/agent
  vi.mock('../src/utils/agent', () => ({
    createNestboxConfig: vi.fn(),
    createZipFromDirectory: vi.fn(),
    extractZip: vi.fn(),
    findProjectRoot: vi.fn(),
    isTypeScriptProject: vi.fn(),
    loadNestboxConfig: vi.fn(),
    runPredeployScripts: vi.fn()
  }));

  // Mock utils/user
  vi.mock('../src/utils/user', () => ({
    userData: vi.fn()
  }));

  // Mock chalk
  vi.mock('chalk', () => ({
    default: {
      green: vi.fn((text) => text),
      red: vi.fn((text) => text),
      yellow: vi.fn((text) => text),
      blue: vi.fn((text) => text)
    }
  }));

  // Mock ora
  vi.mock('ora', () => ({
    default: vi.fn(() => ({
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      text: ''
    }))
  }));

  // Mock cli-table3
  vi.mock('cli-table3', () => ({
    default: vi.fn()
  }));

  // Mock inquirer
  vi.mock('inquirer', () => ({
    default: {
      prompt: vi.fn()
    }
  }));

  // Mock fs
  vi.mock('fs', () => ({
    default: {
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn()
    }
  }));

  // Mock yaml
  vi.mock('yaml', () => ({
    default: {
      load: vi.fn()
    }
  }));

  // Mock axios
  vi.mock('axios', () => ({
    default: {
      get: vi.fn(),
      post: vi.fn()
    }
  }));

  // Mock open
  vi.mock('open', () => ({
    default: vi.fn()
  }));

  // Mock path
  vi.mock('path', () => ({
    default: {
      join: vi.fn(),
      resolve: vi.fn()
    }
  }));
};
