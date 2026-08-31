/**
 * The one path that runs an SST command, parses its output and reports it.
 *
 * Deploy, diff and remove were three classes over an abstract base, and the
 * three were the same five steps with three different error policies:
 *
 * - deploy and remove parsed whatever came back and let a throw reach the
 *   router; diff caught everything into a synthetic result of its own, so the
 *   router's failure handling could never fire for it, and a failed diff
 *   posted no comment at all while a failed deploy did;
 * - each leaked a timeout out of the CLI seam, which now owns them;
 * - only diff accepted an injected parser, which is why its tests were clean
 *   and the other two substituted a parser by spying on a class prototype.
 *
 * One policy now: run, parse, report, return. A throw reaches the router,
 * which already builds a failure result for every operation.
 */

import * as core from "@actions/core";
import type { GitHubClient } from "../github/client";
import type { InfrastructureInputs } from "../inputs/resolve";
import type { OperationParser } from "../parsers/operation-parser";
import { parseStageList } from "../parsers/stage-list";
import type { BaseOperationResult, CommentMode, RemoveResult } from "../types";
import type { SSTCLIExecutor } from "../utils/cli";

export async function runInfrastructureOperation<
  T extends BaseOperationResult,
>({
  createGitHubClient,
  executor,
  inputs,
  parser,
}: {
  createGitHubClient: (token: string) => GitHubClient;
  executor: SSTCLIExecutor;
  inputs: InfrastructureInputs;
  parser: OperationParser<T>;
}): Promise<T> {
  // The timeout is the command's business, so it is not passed here.
  const cliResult = await executor.executeSST(inputs.operation, inputs.stage, {
    maxOutputSize: inputs.maxOutputSize,
    runner: inputs.runner,
  });

  const result = parser.parse(
    cliResult.output,
    inputs.stage,
    cliResult.exitCode,
    cliResult.truncated
  );

  const reported = withCliError(result, cliResult.stderr);

  await reportToGitHub({
    client: createGitHubClient(inputs.token),
    commentMode: inputs.commentMode,
    result: reported,
  });

  return reported;
}

/**
 * Remove, but only when the stage is actually deployed.
 *
 * `sst remove` against a stage that was never deployed fails, which turned
 * every PR-close cleanup for an undeployed PR into a red run. The state
 * backend is asked first (`sst state list` — backend-agnostic), and a stage it
 * does not know about produces a successful no-op result instead of a doomed
 * removal.
 *
 * Fails open on every uncertainty — the check errored, timed out, or printed
 * something unrecognisable — because skipping a real removal is worse than
 * attempting one that fails.
 */
export async function runRemoveOperation({
  createGitHubClient,
  executor,
  inputs,
  parser,
}: {
  createGitHubClient: (token: string) => GitHubClient;
  executor: SSTCLIExecutor;
  inputs: InfrastructureInputs;
  parser: OperationParser<RemoveResult>;
}): Promise<RemoveResult> {
  const skipped = await checkStageNotDeployed(executor, inputs);

  if (skipped) {
    await reportToGitHub({
      client: createGitHubClient(inputs.token),
      commentMode: inputs.commentMode,
      result: skipped,
    });
    return skipped;
  }

  return await runInfrastructureOperation({
    createGitHubClient,
    executor,
    inputs,
    parser,
  });
}

/**
 * @returns A skipped result when the state backend positively confirms the
 *   stage is not deployed, null in every other case (deployed, or unknown).
 */
async function checkStageNotDeployed(
  executor: SSTCLIExecutor,
  inputs: InfrastructureInputs
): Promise<RemoveResult | null> {
  const proceed = (reason: string): null => {
    core.warning(`${reason}; attempting removal anyway`);
    return null;
  };

  // Everything up to the decision sits in one try: any surprise — the command
  // cannot run, times out, or answers in a shape this code does not expect —
  // must land on "attempt the removal", never on an unhandled throw that the
  // router would report as a failed remove.
  try {
    const listResult = await executor.listStages({
      maxOutputSize: inputs.maxOutputSize,
      runner: inputs.runner,
    });

    if (listResult.exitCode !== 0) {
      return proceed(
        `\`sst state list\` exited with code ${listResult.exitCode}`
      );
    }

    const listing = parseStageList(listResult.output);
    if (listing === null) {
      return proceed("Could not parse `sst state list` output");
    }

    if (listing.stages.includes(inputs.stage)) {
      return null;
    }

    core.info(
      `Stage '${inputs.stage}' is not deployed (deployed stages: ${listing.stages.join(", ") || "none"}). Nothing to remove.`
    );

    return {
      app: listing.app ?? "",
      completionStatus: "skipped",
      exitCode: 0,
      operation: "remove",
      rawOutput: listResult.output,
      removedResources: [],
      resourcesRemoved: 0,
      stage: inputs.stage,
      success: true,
      truncated: listResult.truncated,
    };
  } catch (error) {
    return proceed(
      `Could not check deployed stages: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Fall back to the CLI's own account of a failure.
 *
 * Only the deploy parser extracts an `error` from the text; diff and remove
 * never set one. `error` is a declared action output, so without this a failed
 * diff or remove reports an empty one. The diff operation used to cover its
 * own case by discarding the parsed result and substituting `cliResult.stderr`
 * — this keeps the information without throwing the result away.
 */
function withCliError<T extends BaseOperationResult>(
  result: T,
  stderr: string
): T {
  if (result.success || result.error || !stderr.trim()) {
    return result;
  }

  return { ...result, error: stderr.trim() };
}

/**
 * Comment and summarise.
 *
 * One layer of error handling, inside GitHubClient, which turns a failure into
 * a warning and resolves. There used to be three for a single failure: the
 * client's warning, a `.catch` per promise here, and a `Promise.allSettled`
 * around both — so the dedicated error helper could never fire.
 */
async function reportToGitHub({
  client,
  commentMode,
  result,
}: {
  client: GitHubClient;
  commentMode: CommentMode;
  result: BaseOperationResult;
}): Promise<void> {
  await Promise.all([
    client.createOrUpdateComment(result, commentMode),
    client.createWorkflowSummary(result),
  ]);

  core.debug(`Reported ${result.operation} to GitHub`);
}
