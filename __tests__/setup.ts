import { beforeEach, vi } from 'vitest';

// Make vi available globally
(globalThis as any).vi = vi;

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
  DefaultArtifactClient: vi.fn().mockImplementation(() => ({
    uploadArtifact: vi.fn().mockResolvedValue({
      artifactName: 'test-artifact',
      size: 1024,
    }),
  })),
}));

vi.mock('@actions/io', () => ({
  mkdirP: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  };
});

vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
}));

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>();
  return {
    ...actual,
    join: vi.fn((...paths: string[]) => paths.join('/')),
  };
});

// Clean up between tests
beforeEach(() => {
  vi.clearAllMocks();
});
