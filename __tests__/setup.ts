import { beforeEach, vi } from 'vitest';

// Make vi available globally
globalThis.vi = vi;

// Mock GitHub Actions core and github modules for tests
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  summary: {
    addRaw: vi.fn().mockReturnThis(),
    addHeading: vi.fn().mockReturnThis(),
    addSeparator: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
    issue: {
      number: 1,
    },
    payload: {
      pull_request: { number: 123 },
    },
    eventName: 'pull_request',
  },
  getOctokit: vi.fn(),
}));

vi.mock('@actions/artifact', () => ({
  create: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:os', () => ({
  tmpdir: () => '/tmp',
}));

// Clean up between tests
beforeEach(() => {
  vi.clearAllMocks();
});
