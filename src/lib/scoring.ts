/**
 * City scoring. Pure functions only, so the formula can be tuned against real Qloo data
 * and re-tested without touching the network.
 *
 * Input: the places Qloo returns for one city when the artist is the taste signal.
 * Intuition: if a city has many places that strongly match the artist's audience, the
 * artist's audience lives there. We combine three signals:
 *   - strength: mean affinity of the top-K places (how good the best matches are)
 *   - depth:    how many places came back, capped at K (how wide the scene is)
 *   - pull:     mean popularity of those places (whether the scene draws crowds)
 */

export interface ScoringWeights {
  strength: number;
  depth: number;
  pull: number;
  /** How many top results count toward strength and depth. */
  topK: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  strength: 0.6,
  depth: 0.25,
  pull: 0.15,
  topK: 10,
};

/** Numbers pulled from one city's Qloo response. Kept so the LLM can cite them. */
export interface CitySignals {
  affinities: number[];
  popularities: number[];
}

export interface CityScore {
  score: number; // 0..100
  strength: number; // 0..1
  depth: number; // 0..1
  pull: number; // 0..1
  matches: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function scoreCity(
  signals: CitySignals,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): CityScore {
  const top = signals.affinities
    .filter(Number.isFinite)
    .map(clamp01)
    .sort((a, b) => b - a)
    .slice(0, weights.topK);
  const pops = signals.popularities.filter(Number.isFinite).map(clamp01);

  const strength = mean(top);
  const depth = weights.topK > 0 ? top.length / weights.topK : 0;
  const pull = mean(pops);

  const total = weights.strength + weights.depth + weights.pull || 1;
  const raw = (weights.strength * strength + weights.depth * depth + weights.pull * pull) / total;

  return {
    score: Math.round(raw * 1000) / 10,
    strength: round3(strength),
    depth: round3(depth),
    pull: round3(pull),
    matches: top.length,
  };
}

/** Highest score first; ties broken by stronger matches, then by id for determinism. */
export function rankCities<T extends { id: string; score: CityScore }>(cities: T[]): T[] {
  return [...cities].sort(
    (a, b) =>
      b.score.score - a.score.score ||
      b.score.strength - a.score.strength ||
      a.id.localeCompare(b.id),
  );
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
