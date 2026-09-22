import { describe, expect, it } from "vitest";
import { isHttpUrl, selectNonUrlOutputs, selectUrls } from "@/utils/urls";

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
