import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, rankCities, scoreCity } from "@/lib/scoring";

describe("scoreCity", () => {
  it("returns 0 for a city with no matches", () => {
    expect(scoreCity({ affinities: [], popularities: [] })).toEqual({
      score: 0,
      strength: 0,
      depth: 0,
      pull: 0,
      matches: 0,
    });
  });

  it("scores a perfect city at 100", () => {
    const ten = Array(10).fill(1);
    expect(scoreCity({ affinities: ten, popularities: ten }).score).toBe(100);
  });

  it("only counts the top-K affinities toward strength and depth", () => {
    const s = scoreCity({ affinities: [0.9, 0.8, 0.1, 0.1], popularities: [] }, { ...DEFAULT_WEIGHTS, topK: 2 });
    expect(s.strength).toBeCloseTo(0.85);
    expect(s.depth).toBe(1);
    expect(s.matches).toBe(2);
  });

  it("clamps out-of-range values and ignores non-numbers", () => {
    const s = scoreCity({ affinities: [2, -1, Number.NaN], popularities: [5] });
    expect(s.strength).toBe(0.5);
    expect(s.pull).toBe(1);
    expect(s.matches).toBe(2);
  });

  it("rewards a deeper scene when strength is equal", () => {
    const shallow = scoreCity({ affinities: [0.8, 0.8], popularities: [] });
    const deep = scoreCity({ affinities: Array(10).fill(0.8), popularities: [] });
    expect(deep.score).toBeGreaterThan(shallow.score);
  });

  it("respects custom weights", () => {
    const signals = { affinities: [0.2], popularities: [1] };
    const pullOnly = scoreCity(signals, { strength: 0, depth: 0, pull: 1, topK: 10 });
    expect(pullOnly.score).toBe(100);
  });
});

describe("rankCities", () => {
  it("sorts by score, then strength, then id", () => {
    const mk = (id: string, score: number, strength: number) => ({
      id,
      score: { score, strength, depth: 0, pull: 0, matches: 1 },
    });
    const ranked = rankCities([mk("b", 50, 0.5), mk("a", 50, 0.5), mk("c", 50, 0.9), mk("d", 70, 0.1)]);
    expect(ranked.map((c) => c.id)).toEqual(["d", "c", "a", "b"]);
  });
});
