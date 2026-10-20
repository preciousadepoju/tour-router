import "server-only";
import { cacheGet, cacheKey, cacheSet } from "../cache";
import { createLimiter } from "../limit";
import { createLiveClient } from "./live";
import { createSampleClient } from "./sample";
import type { InsightsParams, QlooClient, QlooDebugEntry } from "./types";

export const DEFAULT_QLOO_URL = "https://hackathon.api.qloo.com";

export function qlooMode(): "live" | "sample" {
  return process.env.QLOO_API_KEY ? "live" : "sample";
}

/** Shared across requests so concurrent tours together stay under Qloo's rate limit. */
const limit = createLimiter(4);

let base: QlooClient | undefined;
function baseClient(): QlooClient {
  base ??= process.env.QLOO_API_KEY
    ? createLiveClient(process.env.QLOO_API_KEY, process.env.QLOO_API_URL || DEFAULT_QLOO_URL)
    : createSampleClient();
  return base;
}

/**
 * The client the rest of the app uses: picks live or sample from env, and adds caching,
 * a concurrency limit and (optionally) a debug log of raw responses.
 */
export function getQloo(onDebug?: (entry: QlooDebugEntry) => void): QlooClient {
  const inner = baseClient();

  async function call<T>(endpoint: string, params: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
    const key = cacheKey([inner.mode, endpoint, params]);
    const started = Date.now();
    const hit = await cacheGet<T>(key);
    if (hit !== undefined) {
      onDebug?.({ endpoint, params, ms: Date.now() - started, cached: true, response: hit });
      return hit;
    }
    const value = await limit(fn);
    await cacheSet(key, value);
    onDebug?.({ endpoint, params, ms: Date.now() - started, cached: false, response: value });
    return value;
  }

  return {
    mode: inner.mode,
    search: (query, types) => call("/search", { query, types }, () => inner.search(query, types)),
    insights: (params: InsightsParams) => call("/v2/insights", params, () => inner.insights(params)),
  };
}
