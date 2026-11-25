import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  armoryPath,
  siblingsPath,
  lostark,
  PROXY_ORIGIN,
  rateGate,
  type ApiError,
} from "./api";
import {
  deleteKey,
  getKey,
  KEY,
  read,
  saveKey,
  write,
  type Scope,
  type StoredKey,
} from "./storage";
import type { Armory, Sibling } from "./models";
import { RECENT, RECENT_LIMIT, readRecent, type RecentSearch } from "./recent";

export const TTL = 180_000;
/** Expedition rosters change rarely (guide §5.3: 10–30 min). */
export const SIBLINGS_TTL = 600_000;
/** Short negative cache so repeated typos do not spend quota (guide §5.3). */
export const NOT_FOUND_TTL = 60_000;
const CACHE = "mokokoloa.cache.v1";
const CACHE_ENTRIES = 20;
const notFound = new Map<string, number>();
/** Clears the not-found cache (key change, tests). */
export const clearNotFound = () => notFound.clear();
type Cached = { at: number; keySavedAt: string; data: unknown };
type Session = {
  key: ReturnType<typeof getKey>;
  recent: RecentSearch[];
  recordRecent: (entry: RecentSearch) => void;
  deleteRecent: (name?: string) => void;
  demo: boolean;
  proxyActive: boolean;
  allowProxy: () => boolean;
  disableProxy: () => void;
  request: <T>(
    path: string,
    signal?: AbortSignal,
    proposed?: string,
  ) => Promise<T>;
  store: (scope: Scope, value: StoredKey) => boolean;
  remove: () => boolean;
};
const SessionContext = createContext<Session | null>(null);
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: TTL,
      gcTime: 600_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (count, error) =>
        (error as unknown as ApiError).kind === "server" && count < 1,
    },
  },
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const demo =
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("demo") === "1";
  const [key, setKey] = useState(() => {
    if (!demo) return getKey();
    return new URLSearchParams(location.search).get("setup") === "1"
      ? null
      : {
          scope: "session" as const,
          value: {
            token: "demo.fixture.sample",
            status: "ok" as const,
            savedAt: new Date().toISOString(),
          },
        };
  });
  const client = useQueryClient();
  const [recent, setRecent] = useState(() =>
    key ? readRecent(key.scope) : [],
  );
  const proxy = useRef(false);
  const [proxyActive, setProxyActive] = useState(false);

  function allowProxy() {
    if (!PROXY_ORIGIN || demo) return false;
    if (proxy.current) return true;
    if (
      !window.confirm(
        "API 키와 조회 요청이 " +
          PROXY_ORIGIN +
          " 서버를 거칩니다. 이 탭을 새로고침할 때까지 프록시를 사용하시겠어요?",
      )
    )
      return false;
    proxy.current = true;
    setProxyActive(true);
    return true;
  }

  function disableProxy() {
    proxy.current = false;
    setProxyActive(false);
  }

  useEffect(() => {
    if (demo) return;
    function sync(event: StorageEvent) {
      if (event.key === RECENT && key?.scope === "local") {
        setRecent(readRecent(key.scope));
        return;
      }
      if (event.key !== null && event.key !== KEY) return;
      const next = getKey();
      if (next?.value.token !== key?.value.token) {
        client.clear();
        notFound.clear();
        rateGate.reset();
        write("session", CACHE, undefined);
      }
      if (event.key === null || next?.scope !== key?.scope)
        setRecent(next ? readRecent(next.scope) : []);
      setKey(next);
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [client, demo, key]);

  function resetQueries(resetRate = true) {
    client.clear();
    notFound.clear();
    if (!demo) write("session", CACHE, undefined);
    if (resetRate) rateGate.reset();
  }

  function store(scope: Scope, value: StoredKey) {
    if (!demo && !saveKey(scope, value)) return false;
    if (key?.value.token !== value.token) resetQueries(false);
    if (scope !== key?.scope) setRecent(readRecent(scope));
    setKey({ scope, value });
    return true;
  }

  function remove() {
    const success = demo || deleteKey();
    const clearedLocal = write("local", RECENT, undefined);
    const clearedSession = write("session", RECENT, undefined);
    setRecent([]);
    disableProxy();
    resetQueries();
    setKey(demo ? null : getKey());
    return success && clearedLocal && clearedSession;
  }

  function updateRecent(next: RecentSearch[]) {
    if (!key) return;
    write(key.scope, RECENT, next.length ? next : undefined);
    setRecent(next);
  }

  async function request<T>(
    path: string,
    signal?: AbortSignal,
    proposed?: string,
  ) {
    const token = proposed ?? key?.value.token;
    function updateStatus(
      status: StoredKey["status"],
      previous?: StoredKey["status"][],
    ) {
      const current = demo ? key : getKey();
      if (
        !current ||
        token !== current.value.token ||
        current.value.status === status ||
        (previous && !previous.includes(current.value.status))
      )
        return;
      const value = { ...current.value, status };
      if (status === "ok") value.validatedAt = new Date().toISOString();
      if (!demo) write(current.scope, KEY, value);
      setKey({ scope: current.scope, value });
    }
    try {
      const transport =
        import.meta.env.DEV && demo
          ? (await import("./demo")).demoRequest
          : fetch;
      const result = await lostark<T>(
        path,
        token,
        signal,
        transport,
        proxy.current ? PROXY_ORIGIN : undefined,
      );
      signal?.throwIfAborted();
      // A successful lookup proves the stored key works, so an unverified or
      // previously rejected key is promoted to "ok".
      if (!proposed) updateStatus("ok", ["rejected", "unverified"]);
      return result;
    } catch (error) {
      if ((error as ApiError).kind === "unauthorized") updateStatus("rejected");
      throw error;
    }
  }

  return (
    <SessionContext.Provider
      value={{
        key,
        recent,
        recordRecent: (entry) =>
          updateRecent(
            [entry, ...recent.filter(({ name }) => name !== entry.name)].slice(
              0,
              RECENT_LIMIT,
            ),
          ),
        deleteRecent: (name) =>
          updateRecent(
            name ? recent.filter((entry) => entry.name !== name) : [],
          ),
        demo,
        request,
        store,
        remove,
        proxyActive,
        allowProxy,
        disableProxy,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Session provider missing");
  return session;
}

export function writeCache(entries: [string, Cached][]) {
  // Armory responses are large. When sessionStorage is full, drop the oldest
  // entries until the newest one fits instead of silently caching nothing.
  for (let keep = entries.length; keep > 0; keep--)
    if (write("session", CACHE, Object.fromEntries(entries.slice(-keep))))
      return;
}

function useCharacterQuery<T>(path: string, enabled: boolean, ttl: number) {
  const { demo, key, request } = useSession();
  const savedAt = key?.value.savedAt;
  // Parse the session cache once per path/key instead of on every render.
  const fresh = useMemo(() => {
    if (demo || !savedAt) return undefined;
    const cached = read<Record<string, Cached>>("session", CACHE, {})[path];
    return cached &&
      cached.keySavedAt === savedAt &&
      Date.now() - cached.at < ttl
      ? cached
      : undefined;
  }, [demo, savedAt, path, ttl]);
  return useQuery<T, ApiError>({
    queryKey: [path],
    enabled: Boolean(key && enabled && key.value.status !== "rejected"),
    staleTime: ttl,
    gcTime: Math.max(ttl, 600_000),
    initialData: fresh?.data as T | undefined,
    initialDataUpdatedAt: fresh?.at,
    queryFn: async ({ signal }) => {
      if ((notFound.get(path) ?? 0) > Date.now())
        throw { kind: "not-found" } satisfies ApiError;
      let data: T;
      try {
        data = await request<T>(path, signal);
      } catch (error) {
        if ((error as ApiError).kind === "not-found")
          notFound.set(path, Date.now() + NOT_FOUND_TTL);
        throw error;
      }
      notFound.delete(path);
      signal.throwIfAborted();
      const current = demo ? null : getKey();
      if (current && current.value.token === key?.value.token) {
        const now = Date.now();
        const entries = Object.entries(
          read<Record<string, Cached>>("session", CACHE, {}),
        ).filter(
          ([name, entry]) =>
            name !== path &&
            entry.keySavedAt === current.value.savedAt &&
            now - entry.at < SIBLINGS_TTL,
        );
        writeCache([
          ...entries.slice(-(CACHE_ENTRIES - 1)),
          [path, { at: now, keySavedAt: current.value.savedAt, data }],
        ]);
      }
      return data;
    },
  });
}

export const useArmory = (name: string, enabled = true) =>
  useCharacterQuery<Armory>(armoryPath(name), Boolean(name) && enabled, TTL);
export const useSiblings = (name: string, enabled: boolean) =>
  useCharacterQuery<Sibling[]>(
    siblingsPath(name),
    Boolean(name) && enabled,
    SIBLINGS_TTL,
  );
