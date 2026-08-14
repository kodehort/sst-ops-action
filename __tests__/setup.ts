import { beforeEach, vi } from "vitest";

(globalThis as any).vi = vi;

// Mock GitHub Actions core and github modules for tests
vi.mock("@actions/core", () => ({
  debug: vi.fn(),
  error: vi.fn(),
  getBooleanInput: vi.fn(),
  getInput: vi.fn(),
  info: vi.fn(),
  setFailed: vi.fn(),
  setOutput: vi.fn(),
  setSecret: vi.fn(),
  summary: {
    addHeading: vi.fn().mockReturnThis(),
    addRaw: vi.fn().mockReturnThis(),
    addSeparator: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  },
  warning: vi.fn(),
}));

const mockContext = {
  eventName: "pull_request",
  issue: {
    number: 1,
  },
  payload: {
    pull_request: { number: 123 },
  },
  ref: "refs/heads/main",
  ref_name: "main",
  repo: {
    owner: "test-owner",
    repo: "test-repo",
  },
};

vi.mock("@actions/github", () => ({
  context: mockContext,
  getOctokit: vi.fn(),
}));

vi.mock("@actions/exec", () => ({
  exec: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    access: vi.fn(),
  };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return {
    ...actual,
    tmpdir: vi.fn(() => "/tmp"),
  };
});

vi.mock("node:path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:path")>();
  return {
    ...actual,
    join: vi.fn((...paths: string[]) => paths.join("/")),
  };
});

vi.mock("node:util", () => ({
  promisify: vi.fn((fn) => vi.fn(fn)),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
