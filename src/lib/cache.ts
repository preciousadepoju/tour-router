import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Two-level cache for Qloo responses: process memory first, then JSON files on disk.
 * Qloo allows private server-side caching but not publishing their data, so the cache
 * directory is gitignored. On Vercel only /tmp is writable, so we use it there.
 */
const memory = new Map<string, { value: unknown; expires: number }>();
const TTL_MS = 1000 * 60 * 60 * 24;

const dir = process.env.VERCEL
  ? path.join("/tmp", "qloo-cache")
  : path.join(process.cwd(), ".cache", "qloo");

export function cacheKey(parts: unknown): string {
  return createHash("sha1").update(JSON.stringify(parts)).digest("hex");
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  try {
    const raw = await fs.readFile(path.join(dir, `${key}.json`), "utf8");
    const { value, expires } = JSON.parse(raw) as { value: T; expires: number };
    if (expires > Date.now()) {
      memory.set(key, { value, expires });
      return value;
    }
  } catch {
    // Missing or unreadable file is just a miss.
  }
  return undefined;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const expires = Date.now() + TTL_MS;
  memory.set(key, { value, expires });
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify({ value, expires }));
  } catch {
    // Read-only filesystem: the memory layer still works.
  }
}
