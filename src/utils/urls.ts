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

/**
 * How useful a URL is to someone reading a comment.
 *
 * - `public`: an address a person opens, usually on the app's own domain.
 * - `wildcard`: a pattern such as `https://*.app.example.com`. It names real
 *   addresses but is not one, so it is shown as text rather than as a link.
 * - `infrastructure`: an endpoint behind the public address — a Lambda
 *   function URL, a CloudFront or API Gateway hostname, or an output declared
 *   as an origin. Correct, occasionally needed, rarely the thing to click.
 */
export type UrlTier = "public" | "wildcard" | "infrastructure";

/**
 * One distinct address, with every output key that reported it.
 */
export interface RankedUrl {
  /** Other keys SST printed with the same address, in the order printed. */
  aliases: string[];
  /** The most meaningful of the keys that reported this address. */
  key: string;
  tier: UrlTier;
  /** The address as SST printed it under `key`'s first occurrence. */
  value: string;
}

/** Tier order, most useful first. */
const TIER_RANK: Record<UrlTier, number> = {
  infrastructure: 2,
  public: 0,
  wildcard: 1,
};

/**
 * AWS hostnames that front a resource rather than serve as its address.
 *
 * `amazonaws.com` covers API Gateway (`execute-api`), S3, load balancers and
 * the rest of the regional service endpoints in one rule.
 */
const INFRASTRUCTURE_HOSTS = [
  /\.lambda-url\.[a-z0-9-]+\.on\.aws$/,
  /\.cloudfront\.net$/,
  /\.amazonaws\.com(\.cn)?$/,
];

/** An output key that declares its value an origin, e.g. `api_origin_url`. */
const ORIGIN_KEY = /_origin(_url)?$/i;

/** A component name as SST prints it: `Api`, `WebApp`. */
const COMPONENT_KEY = /^[A-Z]/;

/**
 * Rank a key as a label, lowest first.
 *
 * A component name is the app's own name for the thing; a snake_case output
 * key is usually a re-export of it; an origin key names the plumbing.
 */
function keyRank(key: string): number {
  if (ORIGIN_KEY.test(key)) {
    return 2;
  }
  return COMPONENT_KEY.test(key) ? 0 : 1;
}

function tierOf(url: URL, keys: readonly string[]): UrlTier {
  if (url.hostname.includes("*")) {
    return "wildcard";
  }
  if (
    INFRASTRUCTURE_HOSTS.some((host) => host.test(url.hostname)) ||
    keys.every((key) => ORIGIN_KEY.test(key))
  ) {
    return "infrastructure";
  }
  return "public";
}

/**
 * Collapse the URL outputs to distinct addresses and order them by usefulness.
 *
 * Addresses are compared after URL normalisation, so `https://a.com` and
 * `https://a.com/` are one address. Each address keeps its most meaningful key
 * (ties go to the key printed first) and lists the others as aliases. The
 * result is ordered by tier and, within a tier, by where SST first printed the
 * address — so nothing is reordered that SST's own order already settled.
 *
 * Every input URL is represented exactly once, as a key or as an alias.
 */
export function rankUrls(outputs: readonly SSTOutput[]): RankedUrl[] {
  const groups = new Map<string, { url: URL; outputs: SSTOutput[] }>();

  for (const output of selectUrls(outputs)) {
    const url = new URL(output.value);
    const group = groups.get(url.href);
    if (group) {
      group.outputs.push(output);
    } else {
      groups.set(url.href, { outputs: [output], url });
    }
  }

  const ranked = [...groups.values()].map(({ url, outputs: members }) => {
    const keys = members.map((member) => member.key);
    // Stable: `reduce` keeps the earlier member on a tie.
    const chosen = members.reduce((best, member) =>
      keyRank(member.key) < keyRank(best.key) ? member : best
    );

    return {
      aliases: keys.filter((key) => key !== chosen.key),
      key: chosen.key,
      tier: tierOf(url, keys),
      value: chosen.value,
    };
  });

  // Array.prototype.sort is stable, so SST's order survives within a tier.
  return ranked.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
}

/**
 * Split ranked URLs into those shown and those collapsed, keeping every one.
 *
 * Infrastructure endpoints are collapsed whenever there is anything more
 * useful to show — they are why the addresses people click used to fall past
 * the cut. An app that reports only infrastructure endpoints shows those
 * instead, because a section with nothing visible would read as empty.
 * `limit` then caps what is shown, and the overflow joins the collapsed part
 * ahead of the infrastructure, preserving rank order.
 */
export function partitionUrls(
  ranked: readonly RankedUrl[],
  limit: number
): { hidden: RankedUrl[]; shown: RankedUrl[] } {
  const useful = ranked.filter((url) => url.tier !== "infrastructure");
  const candidates = useful.length > 0 ? useful : [...ranked];
  const shown = candidates.slice(0, Math.max(0, limit));

  return {
    hidden: ranked.filter((url) => !shown.includes(url)),
    shown,
  };
}
