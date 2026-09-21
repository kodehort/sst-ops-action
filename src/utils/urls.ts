/**
 * URL classification for SST outputs
 *
 * SST prints an app's resource URLs in the same key/value block as its other
 * declared outputs, so telling them apart is a value-level question, not a
 * positional one. One predicate serves both the renderer and the `urls` action
 * output; a second copy would be free to disagree with the first.
 */

/**
 * A key/value pair from SST's post-completion outputs block.
 */
export interface SSTOutput {
  key: string;
  value: string;
}

/**
 * Whether a value is a URL worth linking to.
 *
 * Parsed with the URL constructor rather than matched with a prefix test, so a
 * malformed value never becomes a broken markdown link. Restricted to http and
 * https: `file:` and `data:` values are not destinations a reader can follow,
 * and SST emits `arn:` values through the same block.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The outputs whose value is a followable URL, in the order SST printed them.
 */
export function selectUrls(outputs: readonly SSTOutput[]): SSTOutput[] {
  return outputs.filter((output) => isHttpUrl(output.value));
}

/**
 * The outputs whose value is not a URL, in the order SST printed them.
 *
 * The complement of `selectUrls`, so every output lands in exactly one of the
 * two sections and none is rendered twice.
 */
export function selectNonUrlOutputs(
  outputs: readonly SSTOutput[]
): SSTOutput[] {
  return outputs.filter((output) => !isHttpUrl(output.value));
}
