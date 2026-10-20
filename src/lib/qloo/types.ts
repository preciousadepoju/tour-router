/**
 * Every Qloo request/response shape the app touches lives in this file.
 *
 * Fields tagged `ASSUMED` are NOT confirmed by the public docs. The docs (as of Oct 2026) only
 * guarantee `{ success, results: { entities: [...] } }` for /v2/insights and leave the entity
 * shape unspecified. When the real key arrives, hit each endpoint once, compare against these
 * types, and fix them here; `normalize.ts` is the only code that reads raw fields.
 */

export type QlooEntityType =
  | "urn:entity:artist"
  | "urn:entity:place"
  | "urn:entity:album" // search-only legacy type; we filter it out when resolving artists
  | (string & {});

export interface QlooTag {
  tag_id?: string; // ASSUMED field name
  id?: string; // ASSUMED alternative some endpoints may use
  name: string; // ASSUMED
  type?: string; // ASSUMED, e.g. "urn:tag:genre:place"
}

/** One entity in a /search or /v2/insights result. */
export interface QlooEntity {
  entity_id: string; // documented as the ID you pass to signal.interests.entities
  name: string;
  types?: string[]; // ASSUMED (search results)
  subtype?: string; // ASSUMED
  popularity?: number; // ASSUMED 0..1
  query?: {
    affinity?: number; // ASSUMED 0..1, the per-result affinity to the signals
    distance?: number; // ASSUMED metres, places only
  };
  location?: { lat?: number; lon?: number }; // ASSUMED, places only
  properties?: {
    address?: string; // ASSUMED
    short_description?: string; // ASSUMED
    image?: { url?: string }; // ASSUMED
    geocode?: { name?: string; country_code?: string }; // documented via filter.geocode.*
    [key: string]: unknown;
  };
  tags?: QlooTag[]; // ASSUMED
}

/** GET /search */
export interface QlooSearchResponse {
  results: QlooEntity[]; // ASSUMED top-level key
}

/** GET /v2/insights (documented: success + results.entities) */
export interface QlooInsightsResponse {
  success: boolean;
  results: {
    entities?: QlooEntity[];
    /** ASSUMED: shape of a urn:demographics result. Not in the hackathon's supported list. */
    demographics?: QlooDemographicsRow[];
    duration?: number;
  };
}

/** ASSUMED: one row per entity for filter.type=urn:demographics. */
export interface QlooDemographicsRow {
  entity_id: string;
  query?: {
    age?: Record<string, number>; // ASSUMED keys like "24_and_younger", values -1..1
    gender?: Record<string, number>; // ASSUMED keys "male" | "female", values -1..1
  };
}

/** Query params we send to /v2/insights. Only documented parameter names. */
export interface InsightsParams {
  "filter.type": string;
  "signal.interests.entities"?: string;
  "filter.location.query"?: string;
  take?: number;
  [key: string]: string | number | undefined;
}

/** The single interface both adapters implement. Raw responses in, so parsing is shared. */
export interface QlooClient {
  readonly mode: "live" | "sample";
  search(query: string, types?: string): Promise<QlooSearchResponse>;
  insights(params: InsightsParams): Promise<QlooInsightsResponse>;
}

/** One logged request/response pair for the dev debug panel. */
export interface QlooDebugEntry {
  endpoint: string;
  params: Record<string, unknown>;
  ms: number;
  cached: boolean;
  response: unknown;
}
