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
import type { BaseOperationResult, CommentMode } from "../types";
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
