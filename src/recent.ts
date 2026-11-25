import { read, type Scope } from "./storage";

export const RECENT = "arklens.recent.v1";
export const RECENT_LIMIT = 5;
export type RecentSearch = {
  name: string;
  server?: string;
  job?: string;
  level?: string;
};

export function readRecent(scope: Scope) {
  const saved = read<unknown>(scope, RECENT, []);
  if (!Array.isArray(saved)) return [];
  const entries = new Map<string, RecentSearch>();
  for (const item of saved) {
    // The previous version stored character names as strings.
    const entry = typeof item === "string" ? { name: item } : item;
    if (typeof entry?.name !== "string" || !entry.name.trim()) continue;
    if (entries.has(entry.name)) continue;
    entries.set(entry.name, {
      name: entry.name,
      server: typeof entry.server === "string" ? entry.server : undefined,
      job: typeof entry.job === "string" ? entry.job : undefined,
      level: typeof entry.level === "string" ? entry.level : undefined,
    });
    if (entries.size === RECENT_LIMIT) break;
  }
  return [...entries.values()];
}
