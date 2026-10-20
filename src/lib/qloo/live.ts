import type { InsightsParams, QlooClient, QlooInsightsResponse, QlooSearchResponse } from "./types";

export class QlooHttpError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    body: string,
  ) {
    super(`Qloo ${endpoint} returned ${status}: ${body.slice(0, 200)}`);
  }
}

/** Real HTTP adapter. Server-only: the key is read from env and never leaves the server. */
export function createLiveClient(apiKey: string, baseUrl: string): QlooClient {
  const base = baseUrl.replace(/\/+$/, "");

  async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));

    const res = await fetch(`${base}${path}?${qs}`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) throw new QlooHttpError(res.status, path, await res.text());
    return (await res.json()) as T;
  }

  return {
    mode: "live",
    search: (query, types = "urn:entity:artist") =>
      get<QlooSearchResponse>("/search", { query, types, take: 8 }),
    insights: (params: InsightsParams) => get<QlooInsightsResponse>("/v2/insights", params),
  };
}
