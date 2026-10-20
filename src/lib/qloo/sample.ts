import artists from "./fixtures/artists.json";
import places from "./fixtures/places.json";
import { CITIES, type City } from "../cities";
import type {
  InsightsParams,
  QlooClient,
  QlooEntity,
  QlooInsightsResponse,
  QlooSearchResponse,
} from "./types";

/**
 * Offline adapter. Returns responses in the same raw shape as the live API (see types.ts),
 * built from fixtures plus a seeded generator, so every code path after the adapter is the
 * same in both modes. Any artist name works; unknown names get a deterministic profile.
 */

interface Profile {
  regionBias: Record<string, number>;
  cityBias: Record<string, number>;
  similar: QlooEntity[];
  demographics: { age: Record<string, number>; gender: Record<string, number> };
}

const PROFILES = artists.profiles as Record<string, Profile>;
const SEARCH = artists.search as Record<string, QlooEntity[]>;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32: small seeded PRNG so sample output is stable across runs. */
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatedProfile(entityId: string): Profile {
  const r = rng(entityId);
  return {
    regionBias: { us: 0.4 + r() * 0.4, europe: 0.4 + r() * 0.4, africa: 0.4 + r() * 0.4 },
    cityBias: {},
    similar: artists.genericSimilar as QlooEntity[],
    demographics: {
      age: {
        "24_and_younger": r() * 0.6 - 0.1,
        "25_to_29": r() * 0.5,
        "30_to_34": r() * 0.4 - 0.2,
        "35_to_44": r() * 0.4 - 0.3,
        "45_to_54": -r() * 0.5,
        "55_and_older": -r() * 0.6,
      },
      gender: { female: r() * 0.6 - 0.3, male: r() * 0.6 - 0.3 },
    },
  };
}

const profileFor = (id: string) => PROFILES[id] ?? generatedProfile(id);

function findCity(query: string | undefined): City | undefined {
  const q = query?.toLowerCase();
  return CITIES.find((c) => c.query.toLowerCase() === q || c.name.toLowerCase() === q);
}

function placesFor(entityId: string, city: City): QlooEntity[] {
  const profile = profileFor(entityId);
  const r = rng(`${entityId}:${city.id}`);
  const base = profile.cityBias[city.id] ?? (profile.regionBias[city.region] ?? 0.4) * (0.55 + r() * 0.35);
  const count = Math.max(2, Math.min(30, Math.round(4 + base * 26 + r() * 4)));

  const templates = [
    ...places.venues.map((t) => ({ ...t, kind: "venue" })),
    ...places.afterShow.map((t) => ({ ...t, kind: "food" })),
  ];

  return Array.from({ length: count }, (_, i) => {
    const t = templates[(hash(city.id) + i * 7) % templates.length];
    const affinity = Math.max(0.05, Math.min(0.99, base * (1 - i * 0.022) + (r() - 0.5) * 0.06));
    const name = t.name.replace("{city}", city.name) + (i >= templates.length ? ` ${Math.floor(i / templates.length) + 1}` : "");
    return {
      entity_id: `SAMPLE-PLACE-${city.id}-${i}`,
      name,
      popularity: Math.round((0.35 + r() * 0.6) * 1000) / 1000,
      query: { affinity: Math.round(affinity * 1000) / 1000, distance: Math.round(r() * 6000) },
      location: { lat: city.lat + (r() - 0.5) * 0.06, lon: city.lng + (r() - 0.5) * 0.06 },
      properties: { address: `${city.name}, ${city.country}`, geocode: { name: city.name, country_code: city.country } },
      tags: t.tags.map((tag) => ({ tag_id: `urn:tag:sample:${tag.toLowerCase().replace(/\W+/g, "_")}`, name: tag, type: "urn:tag:category:place" })),
    } satisfies QlooEntity;
  }).sort((a, b) => (b.query.affinity ?? 0) - (a.query.affinity ?? 0));
}

export function createSampleClient(): QlooClient {
  return {
    mode: "sample",

    async search(query: string): Promise<QlooSearchResponse> {
      const key = query.trim().toLowerCase();
      const known = SEARCH[key];
      if (known) return { results: known };
      const name = query.trim().replace(/\s+/g, " ");
      return {
        results: [
          {
            entity_id: `SAMPLE-ARTIST-${hash(key).toString(36).toUpperCase()}`,
            name,
            types: ["urn:entity:artist"],
            popularity: 0.5,
            properties: { short_description: "Generated sample artist" },
          },
        ],
      };
    },

    async insights(params: InsightsParams): Promise<QlooInsightsResponse> {
      const entityId = params["signal.interests.entities"] ?? "";
      const take = Number(params.take ?? 20);

      switch (params["filter.type"]) {
        case "urn:entity:place": {
          const city = findCity(params["filter.location.query"]);
          const entities = city ? placesFor(entityId, city).slice(0, take) : [];
          return { success: true, results: { entities } };
        }
        case "urn:entity:artist":
          return { success: true, results: { entities: profileFor(entityId).similar.slice(0, take) } };
        case "urn:demographics":
          return {
            success: true,
            results: { demographics: [{ entity_id: entityId, query: profileFor(entityId).demographics }] },
          };
        default:
          return { success: true, results: { entities: [] } };
      }
    },
  };
}
