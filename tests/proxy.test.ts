// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../proxy/worker";
import { API_BASE } from "../src/api-origin";

const origin = "https://ark-lens.pages.dev";
const local = "http://localhost:5173";
const env = { ALLOWED_ORIGIN: origin, LOCAL_DEV_ORIGIN: local };
const token = "fixture.proxy.token";
const path = "/armories/characters/%EA%B0%80?filters=profiles+equipment";

function send(route: string, init?: RequestInit) {
  return worker.fetch(new Request("https://proxy.example" + route, init), env);
}

afterEach(() => vi.unstubAllGlobals());

describe("Lost Ark Worker proxy", () => {
  it("forwards only selected request headers and exposes upstream quota on errors", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        { Message: "quota" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "12",
            "X-RateLimit-Extra": "1",
            "Set-Cookie": "fixture=value",
            "Access-Control-Allow-Origin": "*",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", request);
    const response = await send(path, {
      headers: {
        Origin: origin,
        "X-Lostark-Key": token,
        Authorization: "ignored",
        Cookie: "ignored",
      },
    });
    expect(request).toHaveBeenCalledExactlyOnceWith(API_BASE + path, {
      headers: { Accept: "application/json", Authorization: "bearer " + token },
      redirect: "error",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ Message: "quota" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(
      response.headers.get("Access-Control-Expose-Headers")?.toLowerCase(),
    ).toContain(
      "x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, x-ratelimit-extra",
    );
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("preflights the optional development origin, allowed path and key header", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const response = await send("/characters/fixture/siblings", {
      method: "OPTIONS",
      headers: {
        Origin: local,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "x-lostark-key",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(local);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "X-Lostark-Key",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects missing or mismatched origins, unlisted routes, methods and missing keys", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const headers = { Origin: origin, "X-Lostark-Key": token };
    expect((await send(path)).status).toBe(403);
    const foreign = await send(path, {
      headers: { ...headers, Origin: origin + ".example" },
    });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.has("Access-Control-Allow-Origin")).toBe(false);
    expect((await send("/guilds/rankings", { headers })).status).toBe(403);
    expect(
      (await send("/armories/characters/foo%2fbar", { headers })).status,
    ).toBe(403);
    expect((await send(path, { method: "POST", headers })).status).toBe(403);
    expect(
      (
        await send(path, {
          method: "OPTIONS",
          headers: { ...headers, "Access-Control-Request-Method": "POST" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await send(path, {
          method: "OPTIONS",
          headers: {
            ...headers,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
          },
        })
      ).status,
    ).toBe(403);
    expect(
      (await send("/news/alarms", { headers: { Origin: origin } })).status,
    ).toBe(401);
    expect(request).not.toHaveBeenCalled();
  });

  it("returns a CORS-readable gateway error without leaking upstream exceptions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(token)));
    const response = await send("/news/alarms", {
      headers: { Origin: origin, "X-Lostark-Key": token },
    });
    expect(response.status).toBe(502);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(await response.text()).toBe("");
  });
});
