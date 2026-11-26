const WINDOW = 60_000;

export class RateGate {
  private requests: number[] = [];
  private observed?: { remaining: number; until: number };
  private blockedUntil = 0;
  private limit = 100;

  snapshot(now = Date.now()) {
    this.requests = this.requests.filter((time) => now - time < WINDOW);
    const observed =
      this.observed && this.observed.until > now ? this.observed : undefined;
    const remaining = Math.max(
      0,
      observed?.remaining ?? this.limit - this.requests.length,
    );
    const resetAt = observed?.until ?? (this.requests[0] ?? now) + WINDOW;
    return {
      remaining,
      limit: this.limit,
      estimated: !observed,
      resetAt,
      waitUntil: Math.max(this.blockedUntil, remaining <= 5 ? resetAt : 0),
    };
  }

  take(now = Date.now()) {
    const { waitUntil } = this.snapshot(now);
    if (waitUntil > now) return waitUntil;
    this.requests.push(now);
    if (this.observed && this.observed.until > now) this.observed.remaining--;
    return null;
  }

  observe(headers: Headers, now = Date.now()) {
    const limit = headers.get("X-RateLimit-Limit");
    const remaining = headers.get("X-RateLimit-Remaining");
    const reset = headers.get("X-RateLimit-Reset");
    const raw = Number(reset);
    const resetAt =
      !reset || !Number.isFinite(raw)
        ? undefined
        : raw >= 1e12
          ? raw
          : raw >= 1e9
            ? raw * 1000
            : now + raw * 1000;
    if (limit && Number(limit) > 0) this.limit = Number(limit);
    if (remaining !== null && /^\d+$/.test(remaining)) {
      this.observed = {
        remaining: Number(remaining),
        until: resetAt ?? this.snapshot(now).resetAt,
      };
    }
    return resetAt;
  }

  block(until: number) {
    this.blockedUntil = Math.max(this.blockedUntil, until);
  }

  reset() {
    this.requests = [];
    this.observed = undefined;
    this.blockedUntil = 0;
    this.limit = 100;
  }
}
