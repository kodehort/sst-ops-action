/**
 * The action's declared output contract has to match what it emits.
 *
 * `main.ts` iterates the formatter's keys blindly into `core.setOutput`, so an
 * output that nobody declared still works — it is simply invisible to anyone
 * reading `action.yml`. Five had drifted out of the metadata that way, and
 * `src/outputs/schema.ts` claimed to "match the outputs defined in action.yml
 * exactly" while it did not.
 *
 * The emitted set here is produced by running the formatter, not read from a
 * hand-maintained list, so a new key reaches this test the moment it can reach
 * a consumer.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OutputFormatter } from "../../src/outputs/formatter";
import type {
  DeployResult,
  DiffResult,
  OperationResult,
  RemoveResult,
  StageResult,
} from "../../src/types";

/**
 * Read the keys of the `outputs:` block from action.yml.
 *
 * Parsed rather than pulled in with a YAML library: the block is a flat
 * key/description map in a file this repository owns, and a dev dependency
 * added for one test is a dependency the bundle gate then has to reason about.
 */
function declaredOutputs(): string[] {
  const lines = readFileSync(join(process.cwd(), "action.yml"), "utf8").split(
    "\n"
  );

  const start = lines.indexOf("outputs:");
  if (start === -1) {
    throw new Error("action.yml has no outputs: block");
  }

  const keys: string[] = [];
  for (const line of lines.slice(start + 1)) {
    // A non-indented, non-empty line ends the block.
    if (/^\S/.test(line)) {
      break;
    }
    const match = line.match(/^ {2}([a-z_]+):\s*$/);
    if (match) {
      keys.push(match[1] as string);
    }
  }

  return keys;
}

/** Alphabetical, so mismatches read as a diff rather than a reordering. */
function sorted(keys: string[]): string[] {
  return [...keys].sort((a, b) => a.localeCompare(b));
}

/** The output names in the README's `## Outputs` table. */
function readmeOutputTable(): string[] {
  const content = readFileSync(join(process.cwd(), "README.md"), "utf8");
  const heading = "## Outputs\n";
  const section = content
    .slice(content.indexOf(heading) + heading.length)
    .split(/^## /m)[0] as string;

  return [...section.matchAll(/^\| `([a-z_]+)` \|/gm)].map(
    (match) => match[1] as string
  );
}

/** The output names given a `### \`name\`` section under API.md's `## Outputs`. */
function apiReferenceSections(): string[] {
  const content = readFileSync(join(process.cwd(), "API.md"), "utf8");
  const heading = "\n## Outputs\n";
  const section = content
    .slice(content.indexOf(heading) + heading.length)
    .split(/^## /m)[0] as string;

  return [...section.matchAll(/^### `([a-z_]+)`/gm)].map(
    (match) => match[1] as string
  );
}

const deploy: DeployResult = {
  app: "test-app",
  completionStatus: "complete",
  exitCode: 0,
  operation: "deploy",
  outputs: [{ key: "API", value: "https://api.example.com" }],
  permalink: "https://console.sst.dev/test-app/staging/deployments/abc123",
  rawOutput: "",
  resourceChanges: 1,
  resources: [{ name: "MyFunction", status: "created", type: "Function" }],
  stage: "staging",
  success: true,
  truncated: false,
};

const diff: DiffResult = {
  app: "test-app",
  changeSummary: "1 change planned",
  changes: [],
  completionStatus: "complete",
  diffSection: "",
  exitCode: 0,
  operation: "diff",
  plannedChanges: 1,
  rawOutput: "",
  stage: "staging",
  success: true,
  truncated: false,
};

const remove: RemoveResult = {
  app: "test-app",
  completionStatus: "complete",
  exitCode: 0,
  operation: "remove",
  rawOutput: "",
  removedResources: [
    { name: "MyFunction", status: "removed", type: "Function" },
  ],
  resourcesRemoved: 1,
  stage: "staging",
  success: true,
  truncated: false,
};

const stage: StageResult = {
  app: "",
  completionStatus: "complete",
  computedStage: "pr-123",
  eventName: "pull_request",
  exitCode: 0,
  isPullRequest: true,
  operation: "stage",
  rawOutput: "",
  ref: "refs/pull/123/merge",
  stage: "pr-123",
  stages: [],
  success: true,
  truncated: false,
};

/** Every key any operation can put in front of a consumer. */
function emittedOutputs(): string[] {
  const results: OperationResult[] = [deploy, diff, remove, stage];
  const keys = new Set<string>();

  for (const result of results) {
    for (const key of Object.keys(
      OutputFormatter.formatOperationForGitHubActions(result)
    )) {
      keys.add(key);
    }
  }

  return sorted([...keys]);
}

describe("Declared action outputs", () => {
  it("declares every output the formatter emits", () => {
    const declared = declaredOutputs();
    const emitted = emittedOutputs();

    // Guards against a parse that silently returns nothing, which would make
    // the comparison below pass for the wrong reason.
    expect(declared.length).toBeGreaterThan(0);

    expect(
      emitted.filter((key) => !declared.includes(key)),
      "Emitted by the formatter but absent from action.yml"
    ).toEqual([]);
  });

  it("declares nothing the formatter never emits", () => {
    const emitted = emittedOutputs();

    expect(
      declaredOutputs().filter((key) => !emitted.includes(key)),
      "Declared in action.yml but never emitted"
    ).toEqual([]);
  });

  it("lists every output in the README table", () => {
    const rows = readmeOutputTable();

    expect(rows.length).toBeGreaterThan(0);
    expect(sorted(rows), "README Outputs table vs action.yml").toEqual(
      sorted(declaredOutputs())
    );
  });

  it("documents every output in the API reference", () => {
    const sections = apiReferenceSections();

    expect(sections.length).toBeGreaterThan(0);
    expect(sorted(sections), "API.md Outputs sections vs action.yml").toEqual(
      sorted(declaredOutputs())
    );
  });
});

/**
 * Example workflows are the copy-paste surface, so a reference to an output the
 * action does not emit silently expands to an empty string. `urls` sat in these
 * files long after it was replaced by `outputs`.
 *
 * Only steps that use this action are checked — the examples also read outputs
 * from their own `run` steps, which are none of this test's business.
 */
const EXAMPLE_WORKFLOWS = [
  "examples/basic-deploy.yml",
  "examples/cleanup.yml",
  "examples/error-handling.yml",
  "examples/multi-environment.yml",
  "examples/pr-workflow.yml",
];

interface ExampleReference {
  file: string;
  key: string;
  stepId: string;
}

function actionStepReferences(): ExampleReference[] {
  const references: ExampleReference[] = [];

  for (const file of EXAMPLE_WORKFLOWS) {
    const content = readFileSync(join(process.cwd(), file), "utf8");

    // Split on list items, so each chunk is one step.
    const steps = content.split(/^\s*- (?=name:|uses:|id:)/m);
    const actionStepIds = new Set<string>();

    for (const step of steps) {
      if (!step.includes("uses: kodehort/sst-ops-action@")) {
        continue;
      }
      const id = step.match(/^\s*id:\s*(\S+)\s*$/m);
      if (id) {
        actionStepIds.add(id[1] as string);
      }
    }

    for (const match of content.matchAll(
      /steps\.([\w-]+)\.outputs\.([\w-]+)/g
    )) {
      const stepId = match[1] as string;
      if (actionStepIds.has(stepId)) {
        references.push({ file, key: match[2] as string, stepId });
      }
    }
  }

  return references;
}

describe("Example workflows", () => {
  it("only read outputs the action declares", () => {
    const references = actionStepReferences();
    const declared = declaredOutputs();

    // Without this, a step-block split that matched nothing would look clean.
    expect(references.length).toBeGreaterThan(10);

    expect(
      references
        .filter((r) => !declared.includes(r.key))
        .map((r) => `${r.file}: steps.${r.stepId}.outputs.${r.key}`),
      "Example workflows read an output the action never emits"
    ).toEqual([]);
  });
});
