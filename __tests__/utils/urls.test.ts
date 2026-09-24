import { describe, expect, it } from "vitest";
import {
  isHttpUrl,
  partitionUrls,
  type RankedUrl,
  rankUrls,
  selectNonUrlOutputs,
  selectUrls,
} from "@/utils/urls";

describe("isHttpUrl", () => {
  it.each([
    "https://kodehort.com",
    "http://localhost:3000",
    "https://api.example.com/v1?key=value#frag",
  ])("accepts %s", (value) => {
    expect(isHttpUrl(value)).toBe(true);
  });

  it.each([
    // The value SST most often puts in the same block as the URLs.
    "arn:aws:iam::196313910340:role/production-GithubActionRole",
    "production-GithubActionRole",
    "",
    "   ",
    "3000",
    "true",
    "not a url",
  ])("rejects %s", (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });

  it("rejects protocols a reader cannot follow", () => {
    // Parseable by the URL constructor, but not a link worth rendering.
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isHttpUrl("ftp://files.example.com")).toBe(false);
    expect(isHttpUrl("data:text/plain,hello")).toBe(false);
    expect(isHttpUrl("postgres://localhost:5432/db")).toBe(false);
  });
});

describe("selectUrls / selectNonUrlOutputs", () => {
  const outputs = [
    { key: "Astro", value: "https://kodehort.com" },
    { key: "github_role_name", value: "production-GithubActionRole" },
    { key: "www", value: "https://kodehort.com" },
    { key: "github_role_arn", value: "arn:aws:iam::1:role/x" },
  ];

  it("keeps the order SST printed", () => {
    expect(selectUrls(outputs)).toEqual([
      { key: "Astro", value: "https://kodehort.com" },
      { key: "www", value: "https://kodehort.com" },
    ]);
  });

  it("keeps duplicate URLs under distinct keys", () => {
    // Astro and www genuinely resolve to the same address; the key is the
    // information, so neither row may be dropped.
    expect(selectUrls(outputs).map((output) => output.value)).toEqual([
      "https://kodehort.com",
      "https://kodehort.com",
    ]);
  });

  it("partitions the outputs, losing and duplicating none", () => {
    const urls = selectUrls(outputs);
    const rest = selectNonUrlOutputs(outputs);

    const byKey = (entries: typeof outputs) =>
      [...entries].sort((a, b) => a.key.localeCompare(b.key));

    expect(urls.length + rest.length).toBe(outputs.length);
    expect(byKey([...urls, ...rest])).toEqual(byKey(outputs));
    expect(rest).toEqual([
      { key: "github_role_name", value: "production-GithubActionRole" },
      { key: "github_role_arn", value: "arn:aws:iam::1:role/x" },
    ]);
  });

  it("handles an empty list", () => {
    expect(selectUrls([])).toEqual([]);
    expect(selectNonUrlOutputs([])).toEqual([]);
  });
});

describe("rankUrls", () => {
  const lambda = "https://abc123.lambda-url.eu-west-2.on.aws/";

  it("lists an address once, under the component name, with the other keys as aliases", () => {
    const ranked = rankUrls([
      { key: "api_origin_url", value: lambda },
      { key: "Api", value: lambda },
      { key: "api_url", value: lambda },
    ]);

    expect(ranked).toEqual([
      {
        aliases: ["api_origin_url", "api_url"],
        key: "Api",
        tier: "infrastructure",
        value: lambda,
      },
    ]);
  });

  it("prefers a plain output key over an origin key", () => {
    const [ranked] = rankUrls([
      { key: "app_origin_url", value: "https://app.example.com" },
      { key: "app_url", value: "https://app.example.com" },
    ]);

    expect(ranked?.key).toBe("app_url");
    expect(ranked?.aliases).toEqual(["app_origin_url"]);
  });

  it("keeps the first printed key when two are equally meaningful", () => {
    const [ranked] = rankUrls([
      { key: "Router", value: "https://kodehort.com" },
      { key: "Web", value: "https://kodehort.com" },
    ]);

    expect(ranked?.key).toBe("Router");
    expect(ranked?.aliases).toEqual(["Web"]);
  });

  it("treats a bare origin and the same origin with a slash as one address", () => {
    const ranked = rankUrls([
      { key: "Web", value: "https://kodehort.com" },
      { key: "www", value: "https://kodehort.com/" },
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.value).toBe("https://kodehort.com");
  });

  it.each([
    ["Api", lambda],
    ["Cdn", "https://d111111abcdef8.cloudfront.net"],
    ["Rest", "https://a1b2c3.execute-api.eu-west-2.amazonaws.com/prod"],
    ["Bucket", "https://my-bucket.s3.eu-west-2.amazonaws.com"],
    ["web_origin_url", "https://origin.example.com"],
  ])("classes %s (%s) as infrastructure", (key, value) => {
    expect(rankUrls([{ key, value }])[0]?.tier).toBe("infrastructure");
  });

  it("classes a host containing * as a wildcard", () => {
    const [ranked] = rankUrls([
      { key: "Router", value: "https://*.app.example.com" },
    ]);

    expect(ranked?.tier).toBe("wildcard");
  });

  it("classes a custom domain as public, even one aliased by an origin key", () => {
    const [ranked] = rankUrls([
      { key: "Web", value: "https://example.com" },
      { key: "web_origin_url", value: "https://example.com" },
    ]);

    expect(ranked?.tier).toBe("public");
  });

  it("orders public, then wildcard, then infrastructure, keeping SST's order within each", () => {
    const ranked = rankUrls([
      { key: "Api", value: lambda },
      { key: "Router", value: "https://*.example.com" },
      { key: "Web", value: "https://example.com" },
      { key: "Cdn", value: "https://d1.cloudfront.net" },
      { key: "Docs", value: "https://docs.example.com" },
    ]);

    expect(ranked.map((url) => url.key)).toEqual([
      "Web",
      "Docs",
      "Router",
      "Api",
      "Cdn",
    ]);
  });

  it("ignores outputs that are not URLs", () => {
    expect(
      rankUrls([{ key: "role_arn", value: "arn:aws:iam::1:role/x" }])
    ).toEqual([]);
  });
});

describe("partitionUrls", () => {
  const url = (key: string, tier: RankedUrl["tier"]): RankedUrl => ({
    aliases: [],
    key,
    tier,
    value: `https://${key}.example.com`,
  });

  it("collapses infrastructure whenever there is something more useful", () => {
    const ranked = [
      url("web", "public"),
      url("router", "wildcard"),
      url("api", "infrastructure"),
    ];

    const { hidden, shown } = partitionUrls(ranked, 10);

    expect(shown.map((u) => u.key)).toEqual(["web", "router"]);
    expect(hidden.map((u) => u.key)).toEqual(["api"]);
  });

  it("shows infrastructure when that is all there is", () => {
    const ranked = [url("api", "infrastructure"), url("cdn", "infrastructure")];

    const { hidden, shown } = partitionUrls(ranked, 1);

    expect(shown.map((u) => u.key)).toEqual(["api"]);
    expect(hidden.map((u) => u.key)).toEqual(["cdn"]);
  });

  it("puts overflow ahead of infrastructure in what it collapses, and drops nothing", () => {
    const ranked = [
      url("a", "public"),
      url("b", "public"),
      url("c", "public"),
      url("api", "infrastructure"),
    ];

    const { hidden, shown } = partitionUrls(ranked, 2);

    expect(shown.map((u) => u.key)).toEqual(["a", "b"]);
    expect(hidden.map((u) => u.key)).toEqual(["c", "api"]);
  });

  it("collapses everything at a limit of zero", () => {
    const ranked = [url("a", "public")];

    expect(partitionUrls(ranked, 0)).toEqual({ hidden: ranked, shown: [] });
  });
});
