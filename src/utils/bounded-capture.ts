/**
 * Bounded capture of a child process's merged stdout and stderr.
 *
 * SST puts what matters most at both ends of its output: the `App:` and
 * `Stage:` header at the start, and the error, the outputs block and the
 * permalink at the end. The middle is progress noise. A capture that kept the
 * first N bytes lost exactly the part a failed or noisy deploy needed, so
 * over budget this keeps a short head and a rolling tail and drops the middle.
 */

type Stream = "stderr" | "stdout";

interface Chunk {
  stream: Stream;
  text: string;
}

/** What a capture holds once the process has exited. */
export interface CapturedOutput {
  /** Both streams merged in arrival order, with a marker where the middle was dropped */
  output: string;
  /** The stderr part of `output` */
  stderr: string;
  /** The stdout part of `output` */
  stdout: string;
  /** Whether anything was dropped */
  truncated: boolean;
}

/**
 * Stands in for the dropped middle. It sits on its own line so that no parser
 * reads it as part of a neighbouring line.
 */
export const TRUNCATION_MARKER =
  "\n[... sst output truncated: middle omitted to fit max-output-size ...]\n";

/**
 * The share of the budget spent on the head. The header SST prints is a few
 * hundred bytes; the rest goes to the tail, where errors and outputs are.
 */
const HEAD_SHARE = 0.1;

/**
 * Keep the start and the end of a stream of chunks within a character budget.
 *
 * The budget covers the head, the marker and the tail together, so `output`
 * never exceeds it. A budget of 0 means no cap. A budget too small to hold the
 * marker twice over keeps only the tail, since the end is what matters most.
 */
export class BoundedCapture {
  private readonly headBudget: number;
  private readonly marker: string;
  private readonly tailBudget: number;
  private readonly unlimited: boolean;

  private readonly head: Chunk[] = [];
  private headLength = 0;

  // A queue with a moving start, so dropping from the front is not a shift.
  private tail: Chunk[] = [];
  private tailStart = 0;
  private tailLength = 0;

  private dropped = false;

  constructor(maxSize: number) {
    this.unlimited = maxSize === 0;
    const withMarker = maxSize > TRUNCATION_MARKER.length * 2;
    this.marker = withMarker ? TRUNCATION_MARKER : "";
    this.headBudget = withMarker ? Math.floor(maxSize * HEAD_SHARE) : 0;
    this.tailBudget = withMarker
      ? maxSize - this.headBudget - TRUNCATION_MARKER.length
      : Math.max(maxSize, 0);
  }

  push(text: string, stream: Stream): void {
    if (this.unlimited) {
      this.head.push({ stream, text });
      return;
    }

    let rest = text;
    const headRoom = this.headBudget - this.headLength;
    if (headRoom > 0) {
      const kept = rest.slice(0, headRoom);
      this.head.push({ stream, text: kept });
      this.headLength += kept.length;
      rest = rest.slice(kept.length);
    }

    if (rest) {
      this.tail.push({ stream, text: rest });
      this.tailLength += rest.length;
      this.evict();
    }
  }

  finish(): CapturedOutput {
    // Nothing went missing, so there is no gap to mark: head and tail are
    // contiguous and are returned as they arrived.
    if (!this.dropped) {
      return join([...this.head, ...this.liveTail()], "", false);
    }

    const tail = this.liveTail();
    const overflow = this.tailLength - this.tailBudget;
    const [first] = tail;
    if (first && overflow > 0) {
      tail[0] = { ...first, text: first.text.slice(overflow) };
    }

    return join(
      trimTrailingPartialLine(this.head),
      this.marker,
      true,
      trimLeadingPartialLine(tail)
    );
  }

  /**
   * Drop whole chunks from the front of the tail while what remains still
   * covers the budget. The last chunk over the line is kept and sliced in
   * `finish`, so memory stays within one chunk of the budget.
   */
  private evict(): void {
    let first = this.tail[this.tailStart];
    while (first && this.tailLength - first.text.length >= this.tailBudget) {
      this.tailLength -= first.text.length;
      this.tailStart += 1;
      this.dropped = true;
      first = this.tail[this.tailStart];
    }

    if (this.tailLength > this.tailBudget) {
      this.dropped = true;
    }

    // Compact once the dead prefix outgrows the live part.
    if (this.tailStart > this.tail.length - this.tailStart) {
      this.tail = this.tail.slice(this.tailStart);
      this.tailStart = 0;
    }
  }

  private liveTail(): Chunk[] {
    return this.tail.slice(this.tailStart);
  }
}

/**
 * Cut the head back to its last newline, so it does not end mid-line. A head
 * with no newline at all is kept whole rather than emptied.
 */
function trimTrailingPartialLine(chunks: Chunk[]): Chunk[] {
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    const chunk = chunks[i] as Chunk;
    const newline = chunk.text.lastIndexOf("\n");
    if (newline !== -1) {
      return [
        ...chunks.slice(0, i),
        { ...chunk, text: chunk.text.slice(0, newline + 1) },
      ];
    }
  }

  return chunks;
}

/**
 * Cut the tail forward past its first newline, so it does not start mid-line.
 * A tail with no newline at all is kept whole rather than emptied.
 */
function trimLeadingPartialLine(chunks: Chunk[]): Chunk[] {
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i] as Chunk;
    const newline = chunk.text.indexOf("\n");
    if (newline !== -1) {
      return [
        { ...chunk, text: chunk.text.slice(newline + 1) },
        ...chunks.slice(i + 1),
      ];
    }
  }

  return chunks;
}

function join(
  head: Chunk[],
  marker: string,
  truncated: boolean,
  tail: Chunk[] = []
): CapturedOutput {
  const pick = (chunks: Chunk[], stream?: Stream): string =>
    chunks
      .filter((chunk) => !stream || chunk.stream === stream)
      .map((chunk) => chunk.text)
      .join("");

  return {
    output: pick(head) + marker + pick(tail),
    stderr: pick(head, "stderr") + pick(tail, "stderr"),
    stdout: pick(head, "stdout") + pick(tail, "stdout"),
    truncated,
  };
}
