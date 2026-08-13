/**
 * Normalisation of the enum-like values SST prints for resources
 *
 * These live with the parsers because that is where the raw CLI string
 * arrives. They used to live in the router, two modules downstream, where they
 * re-narrowed a value the parser's own interface had already declared as a
 * union — so the check could never fire.
 *
 * The router still calls them while the expand/contract is in flight.
 * Normalising an already-normalised value is a no-op, so applying them in both
 * places is harmless.
 */

import * as core from "@actions/core";

export type ResourceStatus = "created" | "updated" | "deleted";
export type DiffAction = "create" | "update" | "delete";
export type RemoveStatus = "removed" | "failed" | "skipped";

const RESOURCE_STATUSES: readonly ResourceStatus[] = [
  "created",
  "updated",
  "deleted",
];
const DIFF_ACTIONS: readonly DiffAction[] = ["create", "update", "delete"];
const REMOVE_STATUSES: readonly RemoveStatus[] = [
  "removed",
  "failed",
  "skipped",
];

/**
 * Build the parenthesised debugging context shared by the normalizers below
 *
 * @returns e.g. " (resource: MyBucket, type: AWS::S3::Bucket)", or "" when
 * neither detail is available
 */
function formatResourceContext({
  resourceName,
  resourceType,
}: {
  resourceName: string | undefined;
  resourceType: string | undefined;
}): string {
  const context: string[] = [];
  if (resourceName) {
    context.push(`resource: ${resourceName}`);
  }
  if (resourceType) {
    context.push(`type: ${resourceType}`);
  }

  return context.length > 0 ? ` (${context.join(", ")})` : "";
}

/**
 * Return `value` when it is one of `validValues`, otherwise warn and fall back
 *
 * Each caller composes its own warning so the wording stays explicit and
 * greppable rather than assembled from fragments.
 */
function normalizeEnumValue<T extends string>({
  value,
  validValues,
  fallback,
  warning,
}: {
  value: string;
  validValues: readonly T[];
  fallback: T;
  warning: () => string;
}): T {
  if ((validValues as readonly string[]).includes(value)) {
    return value as T;
  }

  core.warning(warning());

  return fallback;
}

/**
 * Normalize a deploy resource status
 *
 * Unknown statuses default to 'created' to provide a safe fallback behavior.
 *
 * @param status Raw resource status from SST CLI output
 * @param resourceName Optional resource name for context
 * @param resourceType Optional resource type for context
 */
export function normalizeResourceStatus(
  status: string,
  resourceName?: string,
  resourceType?: string
): ResourceStatus {
  return normalizeEnumValue({
    fallback: "created",
    validValues: RESOURCE_STATUSES,
    value: status,
    warning: () => {
      const contextStr = formatResourceContext({ resourceName, resourceType });
      return (
        `⚠️  Unknown resource status encountered: '${status}'${contextStr}\n` +
        `    Valid statuses: ${RESOURCE_STATUSES.join(", ")}\n` +
        `    Defaulting to: 'created'\n` +
        "    This may indicate a new SST CLI output format."
      );
    },
  });
}

/**
 * Normalize a diff action
 *
 * Unknown actions default to 'update' as the most common operation type.
 *
 * @param action Raw diff action from SST CLI output
 * @param resourceName Optional resource name for context
 * @param resourceType Optional resource type for context
 */
export function normalizeDiffAction(
  action: string,
  resourceName?: string,
  resourceType?: string
): DiffAction {
  return normalizeEnumValue({
    fallback: "update",
    validValues: DIFF_ACTIONS,
    value: action,
    warning: () => {
      const contextStr = formatResourceContext({ resourceName, resourceType });
      return (
        `⚠️  Unknown diff action encountered: '${action}'${contextStr}\n` +
        `    Valid actions: ${DIFF_ACTIONS.join(", ")}\n` +
        `    Defaulting to: 'update'\n` +
        "    This may indicate a new SST CLI diff format."
      );
    },
  });
}

/**
 * Normalize a remove operation status
 *
 * Unknown statuses default to 'failed' to err on the side of caution for
 * removal operations.
 *
 * @param status Raw remove status from SST CLI output
 * @param resourceName Optional resource name for context
 * @param resourceType Optional resource type for context
 */
export function normalizeRemoveStatus(
  status: string,
  resourceName?: string,
  resourceType?: string
): RemoveStatus {
  return normalizeEnumValue({
    fallback: "failed",
    validValues: REMOVE_STATUSES,
    value: status,
    warning: () => {
      const contextStr = formatResourceContext({ resourceName, resourceType });
      return (
        `⚠️  Unknown remove status encountered: '${status}'${contextStr}\n` +
        `    Valid statuses: ${REMOVE_STATUSES.join(", ")}\n` +
        `    Defaulting to: 'failed' (conservative default for removals)\n` +
        "    This may indicate a new SST CLI remove format."
      );
    },
  });
}
