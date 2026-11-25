import { API_BASE } from "../src/api-origin";

type Env = {
  ALLOWED_ORIGIN: string;
  LOCAL_DEV_ORIGIN?: string;
};

const allowedPath =
  /^(?:\/armories\/characters\/[^/]+(?:\/(?:profiles|equipment|avatars|combat-skills|engravings|cards|gems|colosseums|collectibles|arkpassive|arkgrid))?|\/characters\/[^/]+\/siblings|\/news\/alarms)$/u;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname, search } = new URL(request.url);
    const origin = request.headers.get("Origin");
    const headers = new Headers({
      "Cache-Control": "no-store",
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
    });
    const respond = (status: number) => new Response(null, { status, headers });
    if (
      !origin ||
      origin === "null" ||
      (origin !== env.ALLOWED_ORIGIN && origin !== env.LOCAL_DEV_ORIGIN)
    )
      return respond(403);

    headers.set("Access-Control-Allow-Origin", origin);
    if (!allowedPath.test(pathname) || /%2f|%5c/i.test(pathname))
      return respond(403);

    if (request.method === "OPTIONS") {
      const method = request.headers.get("Access-Control-Request-Method");
      const requestedHeaders =
        request.headers.get("Access-Control-Request-Headers") ?? "";
      if (
        method !== "GET" ||
        requestedHeaders
          .split(",")
          .some(
            (name) =>
              !["", "accept", "x-lostark-key"].includes(
                name.trim().toLowerCase(),
              ),
          )
      )
        return respond(403);
      headers.append(
        "Vary",
        "Access-Control-Request-Method, Access-Control-Request-Headers",
      );
      headers.set("Access-Control-Allow-Methods", "GET");
      headers.set("Access-Control-Allow-Headers", "Accept, X-Lostark-Key");
      return respond(204);
    }
    if (request.method !== "GET") return respond(403);

    const key = request.headers.get("X-Lostark-Key")?.trim();
    if (!key) return respond(401);

    let upstream: Response;
    try {
      upstream = await fetch(API_BASE + pathname + search, {
        headers: { Accept: "application/json", Authorization: "bearer " + key },
        redirect: "error",
        cache: "no-store",
        signal: request.signal,
      });
    } catch {
      return respond(502);
    }

    const exposed = [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ];
    for (const [name, value] of upstream.headers) {
      if (!name.startsWith("x-ratelimit-")) continue;
      headers.set(name, value);
      if (!exposed.some((header) => header.toLowerCase() === name))
        exposed.push(name);
    }
    headers.set("Access-Control-Expose-Headers", exposed.join(", "));
    // Return JSON only. Upstream status and quota remain available on errors.
    const json =
      upstream.headers.get("Content-Type")?.split(";")[0].trim() ===
      "application/json";
    if (json) headers.set("Content-Type", "application/json");
    else await upstream.body?.cancel();
    return new Response(json ? upstream.body : null, {
      status: upstream.status,
      headers,
    });
  },
};
