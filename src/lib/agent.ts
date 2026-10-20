import "server-only";
import { citiesFor, REGION_LABELS } from "./cities";
import { getLLM, llmAvailable } from "./llm";
import type { AgentEvent, BaselinePlan, PlanRequest, Stop, TourPlan } from "./plan-types";
import { getQloo } from "./qloo/client";
import {
  citySignals,
  parseDemographics,
  pickArtist,
  similarArtists,
  splitPlaces,
  type ArtistMatch,
} from "./qloo/normalize";
import type { QlooInsightsResponse } from "./qloo/types";
import { haversineKm, orderRoute } from "./route";
import { rankCities, scoreCity } from "./scoring";

export const debugEnabled = () =>
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEBUG === "1";

/**
 * The tour-planning agent. Qloo decides everything that matters (which artist, which
 * cities, in what rank, which venues and openers); code orders the route; the LLM only
 * explains the result. Progress is reported through `emit` so the UI can stream it.
 */
export async function planTour(req: PlanRequest, emit: (e: AgentEvent) => void): Promise<TourPlan> {
  const qloo = getQloo(debugEnabled() ? (entry) => emit({ type: "debug", entry }) : undefined);

  // 1. Resolve the artist to a Qloo entity.
  emit({ type: "step", step: "resolve", status: "active" });
  const found = pickArtist(await qloo.search(req.artist));
  let artist: ArtistMatch | undefined = found.chosen;
  let alternatives = found.alternatives;
  if (req.entityId) {
    const all = [found.chosen, ...found.alternatives].filter((a): a is ArtistMatch => !!a);
    artist = all.find((a) => a.id === req.entityId) ?? { id: req.entityId, name: req.artist };
    alternatives = all.filter((a) => a.id !== req.entityId);
  }
  if (!artist) throw new Error(`Qloo couldn't find an artist called "${req.artist}".`);
  emit({ type: "artist", artist, alternatives });
  emit({ type: "step", step: "resolve", status: "done", detail: artist.name });

  // 2. Score every candidate city by how strongly local places match the artist's audience.
  const candidates = citiesFor(req.region);
  emit({ type: "step", step: "score", status: "active", detail: `${candidates.length} cities` });
  const responses = new Map<string, QlooInsightsResponse>();
  let done = 0;
  const scored = await Promise.all(
    candidates.map(async (city) => {
      const res = await qloo
        .insights({
          "filter.type": "urn:entity:place",
          "signal.interests.entities": artist.id,
          "filter.location.query": city.query,
          take: 30,
        })
        .catch(() => ({ success: false, results: { entities: [] } }) as QlooInsightsResponse);
      responses.set(city.id, res);
      emit({ type: "progress", done: ++done, total: candidates.length });
      return { id: city.id, city, score: scoreCity(citySignals(res)) };
    }),
  );
  const ranked = rankCities(scored).filter((c) => c.score.matches > 0);
  if (ranked.length === 0) throw new Error("Qloo returned no place matches for this artist in these cities.");
  emit({ type: "step", step: "score", status: "done", detail: `top: ${ranked[0].city.name}` });

  // 3. Take the top N and order them into a short route.
  emit({ type: "step", step: "route", status: "active" });
  const top = ranked.slice(0, Math.min(req.stops, ranked.length));
  const route = orderRoute(top.map((t) => ({ ...t, lat: t.city.lat, lng: t.city.lng })));
  emit({ type: "step", step: "route", status: "done", detail: `${route.length} stops` });

  // 4. Venues and after-show spots come from the scoring responses; openers and demographics
  //    are one call each. Qloo's artist type has no location filter, so openers are global
  //    similar-artist picks, rotated so each stop gets different names.
  emit({ type: "step", step: "enrich", status: "active" });
  const [similarRes, demoRes] = await Promise.all([
    qloo.insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": artist.id, take: 12 }),
    qloo
      .insights({ "filter.type": "urn:demographics", "signal.interests.entities": artist.id })
      .catch(() => null),
  ]);
  const similar = similarArtists(similarRes, artist.id, 12);
  const demographics = demoRes ? parseDemographics(demoRes) : null;

  const stops: Stop[] = route.map((r, i) => {
    const places = splitPlaces(responses.get(r.city.id)!);
    const openers = similar.length
      ? Array.from({ length: Math.min(3, similar.length) }, (_, k) => similar[(i * 2 + k) % similar.length])
      : [];
    return {
      order: i + 1,
      city: r.city,
      rank: ranked.findIndex((x) => x.id === r.id) + 1,
      score: r.score,
      reason: "",
      venues: places.venues,
      afterShow: places.afterShow,
      openers,
      legKm: i === 0 ? 0 : Math.round(haversineKm(route[i - 1], r)),
    };
  });
  emit({ type: "step", step: "enrich", status: "done" });

  // 5. Explain. The LLM sees the Qloo numbers and must cite them; it cannot reorder anything.
  emit({ type: "step", step: "reasons", status: "active" });
  let reasonsBy: TourPlan["reasonsBy"] = "template";
  let model: string | undefined;
  if (llmAvailable()) {
    try {
      const llm = getLLM();
      const reasons = await writeReasons(llm, artist, stops, ranked.length);
      for (const s of stops) s.reason = reasons.get(s.city.id) ?? templateReason(s, ranked.length);
      reasonsBy = "llm";
      model = llm.model;
    } catch (err) {
      console.error("LLM reasons failed, using templates:", err);
    }
  }
  for (const s of stops) if (!s.reason) s.reason = templateReason(s, ranked.length);
  emit({ type: "step", step: "reasons", status: "done" });

  return {
    mode: qloo.mode,
    artist,
    alternatives,
    region: req.region,
    stops,
    ranked: ranked.map(({ city, score }) => ({ city, score })),
    demographics,
    demographicsNote: demographics
      ? undefined
      : "Qloo's hackathon environment didn't return demographics for this artist.",
    totalKm: stops.reduce((sum, s) => sum + s.legKm, 0),
    reasonsBy,
    model,
  };
}

function templateReason(s: Stop, total: number): string {
  const venue = s.venues[0]?.name;
  return (
    `Ranked #${s.rank} of ${total} cities. Qloo found ${s.score.matches} local places that match this ` +
    `artist's audience, with an average affinity of ${s.score.strength.toFixed(2)}` +
    (venue ? `; the strongest venue match is ${venue}.` : ".")
  );
}

async function writeReasons(
  llm: ReturnType<typeof getLLM>,
  artist: ArtistMatch,
  stops: Stop[],
  total: number,
): Promise<Map<string, string>> {
  const facts = stops.map((s) => ({
    cityId: s.city.id,
    city: `${s.city.name}, ${s.city.country}`,
    rank: `${s.rank} of ${total}`,
    score: s.score.score,
    matchingPlaces: s.score.matches,
    meanAffinity: s.score.strength,
    meanPopularity: s.score.pull,
    topVenues: s.venues.map((v) => `${v.name} (affinity ${v.affinity.toFixed(2)})`),
    afterShow: s.afterShow.map((v) => v.name),
    openers: s.openers.map((o) => o.name),
  }));

  const out = await llm.json<{ reasons: { cityId: string; reason: string }[] }>({
    system:
      "You write tour-routing notes for an independent artist's team. The data comes from Qloo's " +
      "taste graph and is authoritative. Write one reason per stop, 1-2 sentences, under 45 words. " +
      "Every reason must cite at least one specific number or named place from the data. Never invent " +
      "facts, venues, or statistics that are not in the data, and never second-guess the ranking.",
    prompt: `Artist: ${artist.name}\nStops (Qloo signals):\n${JSON.stringify(facts, null, 2)}`,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["reasons"],
      properties: {
        reasons: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["cityId", "reason"],
            properties: { cityId: { type: "string" }, reason: { type: "string" } },
          },
        },
      },
    },
  });
  return new Map(out.reasons.map((r) => [r.cityId, r.reason]));
}

/** The "Without Qloo" side: the same question asked of the LLM alone. */
export async function planBaseline(req: PlanRequest): Promise<BaselinePlan> {
  const llm = getLLM();
  const out = await llm.json<{ stops: BaselinePlan["stops"] }>({
    system:
      "You are a tour planner. Plan a concert tour using only your general knowledge. Order the stops " +
      "into a sensible travel route. Name real venues and real opening acts where you can.",
    prompt:
      `Plan a ${req.stops}-stop tour for the artist "${req.artist}" in ${REGION_LABELS[req.region]}. ` +
      "For each stop give the city, ISO country code, approximate lat/lng, a one-sentence reason, " +
      "two venues and two possible opening acts.",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["stops"],
      properties: {
        stops: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["city", "country", "lat", "lng", "reason", "venues", "openers"],
            properties: {
              city: { type: "string" },
              country: { type: "string" },
              lat: { type: "number" },
              lng: { type: "number" },
              reason: { type: "string" },
              venues: { type: "array", items: { type: "string" } },
              openers: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  });
  return { stops: out.stops.slice(0, req.stops), model: llm.model };
}

export function parsePlanRequest(body: unknown): PlanRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const artist = typeof b.artist === "string" ? b.artist.trim().slice(0, 80) : "";
  if (!artist) throw new Error("Enter an artist name.");
  const region = (["all", "us", "europe", "africa"] as const).find((r) => r === b.region) ?? "all";
  const stops = Math.min(12, Math.max(2, Math.round(Number(b.stops) || 6)));
  const entityId = typeof b.entityId === "string" && b.entityId.length < 120 ? b.entityId : undefined;
  return { artist, region, stops, entityId };
}

