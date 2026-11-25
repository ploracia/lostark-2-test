import { RateGate } from "./rateGate";
import { API_BASE } from "./api-origin";
import { parseProxyOrigin } from "./proxy-url";

export { API_BASE };
export const PROXY_ORIGIN = parseProxyOrigin(import.meta.env.VITE_PROXY_URL);
export const PORTAL = API_BASE + "/";
export const ALARMS_PATH = "/news/alarms";
export const ARMORY_FILTERS =
  "profiles+equipment+avatars+engravings+cards+gems+arkpassive+arkgrid";
export const armoryPath = (name: string) =>
  "/armories/characters/" +
  encodeURIComponent(name.trim()) +
  "?filters=" +
  ARMORY_FILTERS;
export const siblingsPath = (name: string) =>
  "/characters/" + encodeURIComponent(name.trim()) + "/siblings";
export const rateGate = new RateGate();

export type ApiError = (
  | {
      kind: "no-key" | "unauthorized" | "not-found" | "maintenance" | "network";
    }
  | { kind: "rate-limited"; resetAt: number }
  | { kind: "server"; status: number }
) & { detail?: string };

export async function lostark<T>(
  path: string,
  token?: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
  proxyOrigin?: string,
): Promise<T> {
  signal?.throwIfAborted();
  if (!token) throw { kind: "no-key" } satisfies ApiError;
  const waitUntil = rateGate.take();
  if (waitUntil !== null)
    throw { kind: "rate-limited", resetAt: waitUntil } satisfies ApiError;
  let response: Response;
  try {
    response = await request((proxyOrigin ?? API_BASE) + path, {
      signal,
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
      headers: proxyOrigin
        ? { accept: "application/json", "x-lostark-key": token }
        : { accept: "application/json", authorization: "bearer " + token },
    });
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof TypeError)
      throw { kind: "network" } satisfies ApiError;
    throw error;
  }
  const reset = rateGate.observe(response.headers);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    signal?.throwIfAborted();
    const message =
      body && typeof body === "object" && "Message" in body
        ? body.Message
        : undefined;
    const detail =
      typeof message === "string"
        ? message.replaceAll(token, "[API 키]").slice(0, 300)
        : undefined;
    if (response.status === 401)
      throw { kind: "unauthorized", detail } satisfies ApiError;
    if (response.status === 404)
      throw { kind: "not-found", detail } satisfies ApiError;
    if (response.status === 503)
      throw { kind: "maintenance", detail } satisfies ApiError;
    if (response.status === 429) {
      const resetAt = Math.max(
        Date.now() + 1000,
        reset ?? rateGate.snapshot().resetAt,
      );
      rateGate.block(resetAt);
      throw { kind: "rate-limited", resetAt, detail } satisfies ApiError;
    }
    throw {
      kind: "server",
      status: response.status,
      detail,
    } satisfies ApiError;
  }
  let data: T | null;
  try {
    data = await response.json();
  } catch {
    signal?.throwIfAborted();
    throw { kind: "server", status: response.status } satisfies ApiError;
  }
  if (
    data === null ||
    (path.startsWith("/armories/characters/") &&
      (data as { ArmoryProfile?: unknown }).ArmoryProfile == null)
  ) {
    throw { kind: "not-found" } satisfies ApiError;
  }
  return data;
}
