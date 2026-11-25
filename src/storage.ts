export const KEY = "mokokoloa.apiKey.v1";
export type StoredKey = {
  token: string;
  savedAt: string;
  validatedAt?: string;
  status: "ok" | "unverified" | "rejected";
};
export type Scope = "local" | "session";

function storageFor(scope: Scope) {
  return window[scope === "local" ? "localStorage" : "sessionStorage"];
}

function legacyKey(key: string) {
  return key.startsWith("mokokoloa.")
    ? "arklens." + key.slice("mokokoloa.".length)
    : null;
}

export function readRaw(scope: Scope, key: string) {
  try {
    const storage = storageFor(scope);
    const current = storage.getItem(key);
    const oldKey = legacyKey(key);
    const previous = oldKey === null ? null : storage.getItem(oldKey);
    if (oldKey !== null && previous !== null) {
      try {
        if (current === null) storage.setItem(key, previous);
        storage.removeItem(oldKey);
      } catch {
        // Keep the old value available if the move cannot finish.
      }
    }
    return current ?? previous;
  } catch {
    return null;
  }
}

export function read<T>(scope: Scope, key: string, fallback: T): T {
  try {
    return JSON.parse(readRaw(scope, key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeRaw(scope: Scope, key: string, value: string | undefined) {
  try {
    const storage = storageFor(scope);
    const oldKey = legacyKey(key);
    if (value === undefined && oldKey !== null) storage.removeItem(oldKey);
    if (value === undefined) storage.removeItem(key);
    else {
      storage.setItem(key, value);
      if (oldKey !== null) storage.removeItem(oldKey);
    }
    return true;
  } catch {
    return false;
  }
}

export function write(scope: Scope, key: string, value: unknown) {
  try {
    return writeRaw(scope, key, JSON.stringify(value));
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
