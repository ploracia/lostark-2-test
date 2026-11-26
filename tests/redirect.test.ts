import { describe, expect, it } from "vitest";
import { redirectUrl } from "../redirect/ark-lens/_redirect-url.js";
import { legacyArrivalPath } from "../src/legacy-arrival";

describe("old address redirect", () => {
  it.each([
    ["/", "/?from=ark-lens"],
    [
      "/?q=a%2Bb&tag=1&tag=2#/c/%EB%AA%A8%EA%BC%AC%EA%BC%AC",
      "/?q=a%2Bb&tag=1&tag=2&from=ark-lens#/c/%EB%AA%A8%EA%BC%AC%EA%BC%AC",
    ],
    [
      "/c/%ED%85%8C%EC%8A%A4%ED%8A%B8/transfer?from=other&from=again&demo=1#detail",
      "/c/%ED%85%8C%EC%8A%A4%ED%8A%B8/transfer?from=ark-lens&demo=1#detail",
    ],
    ["//example.com/a", "//example.com/a?from=ark-lens"],
    ["/index.html#/settings/key", "/index.html?from=ark-lens#/settings/key"],
  ])("redirects %s to the fixed Mokokoloa origin", (source, expected) => {
    expect(redirectUrl(new URL("https://ark-lens.pages.dev" + source))).toBe(
      "https://mokokoloa.pages.dev" + expected,
    );
  });

  it("restores the 301 destination's original path, query, and hash", () => {
    expect(
      legacyArrivalPath(
        new URL(
          "https://mokokoloa.pages.dev/_from-ark-lens/c/example?q=a%2Bb#detail",
        ),
      ),
    ).toBe("/c/example?q=a%2Bb&from=ark-lens#detail");
    expect(
      legacyArrivalPath(new URL("https://mokokoloa.pages.dev/c/example")),
    ).toBeNull();
    expect(
      legacyArrivalPath(
        new URL("https://mokokoloa.pages.dev/_from-ark-lens//other.test"),
      ),
    ).toBe("/%2Fother.test?from=ark-lens");
  });
});
