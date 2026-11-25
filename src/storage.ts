export const KEY = "arklens.apiKey.v1";
export type StoredKey = {
  token: string;
  savedAt: string;
  validatedAt?: string;
  status: "ok" | "unverified" | "rejected";
};
export type Scope = "local" | "session";

export function read<T>(scope: Scope, key: string, fallback: T): T {
  try {
    return (
      JSON.parse(
        window[scope === "local" ? "localStorage" : "sessionStorage"].getItem(
          key,
        ) ?? "null",
      ) ?? fallback
    );
  } catch {
    return fallback;
  }
}

export function write(scope: Scope, key: string, value: unknown) {
  try {
    const storage =
      window[scope === "local" ? "localStorage" : "sessionStorage"];
    if (value === undefined) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function normalizeKey(input: string) {
  let token = input.trim();
  let previous: string;
  do {
    previous = token;
    token = token.replace(/^bearer\s+/i, "").trim();
    if (
      (token.startsWith("{") && token.endsWith("}")) ||
      (token.startsWith("<") && token.endsWith(">"))
    ) {
      token = token.slice(1, -1).trim();
    }
  } while (token !== previous);
  return token;
}

export const validKey = (token: string) =>
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
export const maskKey = (token: string) => "…" + token.slice(-4);

export function getKey() {
  for (const scope of ["session", "local"] as const) {
    const value = read<StoredKey | null>(scope, KEY, null);
    if (typeof value?.token === "string" && validKey(value.token))
      return { scope, value };
  }
  return null;
}

export function saveKey(scope: Scope, value: StoredKey) {
  if (!write(scope, KEY, value)) return false;
  write(scope === "local" ? "session" : "local", KEY, undefined);
  return true;
}
export function deleteKey() {
  const session = write("session", KEY, undefined);
  const local = write("local", KEY, undefined);
  return session && local;
}
