import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  armoryPath,
  siblingsPath,
  lostark,
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

export const TTL = 180_000;
const CACHE = "arklens.cache.v1";
type Cached = { at: number; keySavedAt: string; data: unknown };
type Session = {
  key: ReturnType<typeof getKey>;
  demo: boolean;
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

  useEffect(() => {
    if (demo) return;
    function sync(event: StorageEvent) {
      if (event.key !== null && event.key !== KEY) return;
      const next = getKey();
      if (next?.value.token !== key?.value.token) {
        client.clear();
        rateGate.reset();
        write("session", CACHE, undefined);
      }
      setKey(next);
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [client, demo, key]);

  function resetQueries(resetRate = true) {
    client.clear();
    if (!demo) write("session", CACHE, undefined);
    if (resetRate) rateGate.reset();
  }

  function store(scope: Scope, value: StoredKey) {
    if (!demo && !saveKey(scope, value)) return false;
    if (key?.value.token !== value.token) resetQueries(false);
    setKey({ scope, value });
    return true;
  }

  function remove() {
    const success = demo || deleteKey();
    resetQueries();
    setKey(demo ? null : getKey());
    return success;
  }

  async function request<T>(
    path: string,
    signal?: AbortSignal,
    proposed?: string,
  ) {
    const token = proposed ?? key?.value.token;
    function updateStatus(
      status: StoredKey["status"],
      previous?: StoredKey["status"],
    ) {
      const current = demo ? key : getKey();
      if (
        !current ||
        token !== current.value.token ||
        current.value.status === status ||
        (previous && current.value.status !== previous)
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
      const result = await lostark<T>(path, token, signal, transport);
      signal?.throwIfAborted();
      if (!proposed) updateStatus("ok", "rejected");
      return result;
    } catch (error) {
      if ((error as ApiError).kind === "unauthorized") updateStatus("rejected");
      throw error;
    }
  }

  return (
    <SessionContext.Provider value={{ key, demo, request, store, remove }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Session provider missing");
  return session;
}

function useCharacterQuery<T>(path: string, enabled: boolean) {
  const { demo, key, request } = useSession();
  const cached =
    !demo && key
      ? read<Record<string, Cached>>("session", CACHE, {})[path]
      : undefined;
  const fresh =
    cached &&
    cached.keySavedAt === key?.value.savedAt &&
    Date.now() - cached.at < TTL
      ? cached
      : undefined;
  return useQuery<T, ApiError>({
    queryKey: [path],
    enabled: Boolean(key && enabled && key.value.status !== "rejected"),
    initialData: fresh?.data as T | undefined,
    initialDataUpdatedAt: fresh?.at,
    queryFn: async ({ signal }) => {
      const data = await request<T>(path, signal);
      signal.throwIfAborted();
      const current = demo ? null : getKey();
      if (current && current.value.token === key?.value.token) {
        const entries = Object.entries(
          read<Record<string, Cached>>("session", CACHE, {}),
        )
          .filter(
            ([name, entry]) =>
              name !== path &&
              entry.keySavedAt === current.value.savedAt &&
              Date.now() - entry.at < TTL,
          )
          .slice(-19);
        write(
          "session",
          CACHE,
          Object.fromEntries([
            ...entries,
            [path, { at: Date.now(), keySavedAt: current.value.savedAt, data }],
          ]),
        );
      }
      return data;
    },
  });
}

export const useArmory = (name: string, enabled = true) =>
  useCharacterQuery<Armory>(armoryPath(name), Boolean(name) && enabled);
export const useSiblings = (name: string, enabled: boolean) =>
  useCharacterQuery<Sibling[]>(siblingsPath(name), Boolean(name) && enabled);
