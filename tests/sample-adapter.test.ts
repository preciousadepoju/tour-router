import { beforeAll, describe, expect, it } from "vitest";
import { createSampleClient } from "@/lib/qloo/sample";
import { citySignals, parseDemographics, pickArtist, splitPlaces } from "@/lib/qloo/normalize";

const qloo = createSampleClient();

describe("sample adapter", () => {
  it("reports sample mode", () => {
    expect(qloo.mode).toBe("sample");
  });

  it("skips albums and surfaces other artists as alternatives", async () => {
    const { chosen, alternatives } = pickArtist(await qloo.search("Tems"));
    expect(chosen?.name).toBe("Tems");
    expect(alternatives.map((a) => a.name)).toEqual(["Temz"]);
  });

  it("generates a stable artist for unknown names", async () => {
    const a = pickArtist(await qloo.search("Some New Artist")).chosen;
    const b = pickArtist(await qloo.search("some new artist")).chosen;
    expect(a?.id).toBeTruthy();
    expect(a?.id).toBe(b?.id);
  });

  it("returns place results in the raw insights shape, sorted by affinity", async () => {
    const res = await qloo.insights({
      "filter.type": "urn:entity:place",
      "signal.interests.entities": "SAMPLE-ARTIST-TEMS",
      "filter.location.query": "Lagos",
      take: 30,
    });
    expect(res.success).toBe(true);
    const signals = citySignals(res);
    expect(signals.affinities.length).toBeGreaterThan(5);
    expect([...signals.affinities].sort((x, y) => y - x)).toEqual(signals.affinities);
  });

  it("is deterministic", async () => {
    const p = { "filter.type": "urn:entity:place", "signal.interests.entities": "X", "filter.location.query": "Berlin" };
    expect(await qloo.insights(p)).toEqual(await qloo.insights(p));
  });

  it("returns no places for an unknown location", async () => {
    const res = await qloo.insights({
      "filter.type": "urn:entity:place",
      "signal.interests.entities": "SAMPLE-ARTIST-TEMS",
      "filter.location.query": "Atlantis",
    });
    expect(res.results.entities).toEqual([]);
  });

  it("splits places into venues and after-show spots", async () => {
    const res = await qloo.insights({
      "filter.type": "urn:entity:place",
      "signal.interests.entities": "SAMPLE-ARTIST-ASAKE",
      "filter.location.query": "London",
      take: 30,
    });
    const { venues, afterShow } = splitPlaces(res);
    expect(venues.length).toBeGreaterThan(0);
    expect(afterShow.length).toBeGreaterThan(0);
    expect(venues.some((v) => afterShow.some((a) => a.id === v.id))).toBe(false);
  });

  it("returns similar artists and demographics", async () => {
    const similar = await qloo.insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": "SAMPLE-ARTIST-TYLA" });
    expect(similar.results.entities?.[0]?.name).toBe("Uncle Waffles");
    const demo = parseDemographics(
      await qloo.insights({ "filter.type": "urn:demographics", "signal.interests.entities": "SAMPLE-ARTIST-TYLA" }),
    );
    expect(demo?.age.length).toBe(6);
    expect(demo?.gender.map((g) => g.bucket).sort()).toEqual(["female", "male"]);
  });
});

describe("planTour in sample mode", () => {
  beforeAll(() => {
    delete process.env.QLOO_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("plans a full tour end to end with template reasons", async () => {
    const { planTour } = await import("@/lib/agent");
    const steps: string[] = [];
    const plan = await planTour({ artist: "Tems", region: "all", stops: 6 }, (e) => {
      if (e.type === "step" && e.status === "done") steps.push(e.step);
    });
    expect(plan.mode).toBe("sample");
    expect(plan.artist.name).toBe("Tems");
    expect(plan.stops).toHaveLength(6);
    expect(plan.stops.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plan.reasonsBy).toBe("template");
    expect(plan.stops.every((s) => s.reason.length > 20 && s.openers.length > 0)).toBe(true);
    expect(steps).toEqual(["resolve", "score", "route", "enrich", "reasons"]);
    // The stops are the six best-ranked cities, just reordered for travel.
    expect(plan.stops.map((s) => s.rank).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("respects the region filter", async () => {
    const { planTour } = await import("@/lib/agent");
    const plan = await planTour({ artist: "Asake", region: "africa", stops: 4 }, () => {});
    expect(plan.stops.every((s) => s.city.region === "africa")).toBe(true);
  });
});
