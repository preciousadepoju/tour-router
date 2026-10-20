import type { CitySignals } from "../scoring";
import type { QlooEntity, QlooInsightsResponse, QlooSearchResponse } from "./types";

/**
 * The only code that reads raw Qloo fields. If real responses differ from types.ts,
 * the fixes land here and in types.ts, nowhere else.
 */

export interface ArtistMatch {
  id: string;
  name: string;
  description?: string;
  popularity?: number;
}

export interface PlaceSummary {
  id: string;
  name: string;
  affinity: number;
  tags: string[];
  address?: string;
  lat?: number;
  lng?: number;
}

export interface Demographics {
  age: { bucket: string; value: number }[];
  gender: { bucket: string; value: number }[];
}

const toMatch = (e: QlooEntity): ArtistMatch => ({
  id: e.entity_id,
  name: e.name,
  description: e.properties?.short_description,
  popularity: e.popularity,
});

/**
 * Names are ambiguous (an album and an artist can share a name). Take the top-ranked
 * candidate that is not an album and keep the other artists as alternatives for the UI.
 */
export function pickArtist(res: QlooSearchResponse): { chosen?: ArtistMatch; alternatives: ArtistMatch[] } {
  const candidates = (res.results ?? []).filter((e) => {
    const types = e.types ?? [];
    if (types.some((t) => t.includes("album"))) return false;
    return types.length === 0 || types.some((t) => t.includes("artist"));
  });
  const [first, ...rest] = candidates.map(toMatch);
  return { chosen: first, alternatives: rest.slice(0, 4) };
}

export function citySignals(res: QlooInsightsResponse): CitySignals {
  const entities = res.results?.entities ?? [];
  return {
    affinities: entities.map((e) => e.query?.affinity).filter((n): n is number => typeof n === "number"),
    popularities: entities.map((e) => e.popularity).filter((n): n is number => typeof n === "number"),
  };
}

const VENUE_WORDS = /venue|concert|music|club|theat|hall|arena|stage|live|amphi|auditor/i;
const FOOD_WORDS = /restaurant|bar|lounge|cafe|café|kitchen|grill|food|eat|wine|cocktail|pub|supper/i;

function toPlace(e: QlooEntity): PlaceSummary {
  return {
    id: e.entity_id,
    name: e.name,
    affinity: e.query?.affinity ?? 0,
    tags: (e.tags ?? []).map((t) => t.name).filter(Boolean).slice(0, 3),
    address: e.properties?.address,
    lat: e.location?.lat,
    lng: e.location?.lon,
  };
}

/**
 * Splits one city's place results into venue-type places and after-show spots, using tag
 * and name keywords. A place matching both lists counts as a venue.
 */
export function splitPlaces(res: QlooInsightsResponse, max = 3): { venues: PlaceSummary[]; afterShow: PlaceSummary[] } {
  const venues: PlaceSummary[] = [];
  const afterShow: PlaceSummary[] = [];
  for (const e of res.results?.entities ?? []) {
    const text = `${e.name} ${(e.tags ?? []).map((t) => t.name).join(" ")}`;
    if (VENUE_WORDS.test(text) && venues.length < max) venues.push(toPlace(e));
    else if (FOOD_WORDS.test(text) && afterShow.length < max) afterShow.push(toPlace(e));
  }
  return { venues, afterShow };
}

export function similarArtists(res: QlooInsightsResponse, excludeId: string, max = 3): ArtistMatch[] {
  return (res.results?.entities ?? [])
    .filter((e) => e.entity_id !== excludeId)
    .slice(0, max)
    .map(toMatch);
}

const AGE_LABELS: Record<string, string> = {
  "24_and_younger": "≤24",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};

export function parseDemographics(res: QlooInsightsResponse): Demographics | null {
  const row = res.results?.demographics?.[0]?.query;
  if (!row?.age && !row?.gender) return null;
  const rows = (obj: Record<string, number> | undefined, labels: Record<string, string> = {}) =>
    Object.entries(obj ?? {}).map(([k, v]) => ({ bucket: labels[k] ?? k, value: v }));
  return { age: rows(row.age, AGE_LABELS), gender: rows(row.gender) };
}
