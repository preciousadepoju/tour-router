import type { City, RegionFilter } from "./cities";
import type { ArtistMatch, Demographics, PlaceSummary } from "./qloo/normalize";
import type { QlooDebugEntry } from "./qloo/types";
import type { CityScore } from "./scoring";

/** Shapes shared by the API routes and the browser. */

export type StepId = "resolve" | "score" | "route" | "enrich" | "reasons";

export const STEP_LABELS: Record<StepId, string> = {
  resolve: "Resolving artist",
  score: "Scoring cities",
  route: "Planning route",
  enrich: "Finding venues & openers",
  reasons: "Writing reasons",
};

export interface PlanRequest {
  artist: string;
  /** Set when the user picks a different match from the disambiguation list. */
  entityId?: string;
  region: RegionFilter;
  stops: number;
}

export interface Stop {
  order: number;
  city: City;
  rank: number;
  score: CityScore;
  reason: string;
  venues: PlaceSummary[];
  afterShow: PlaceSummary[];
  openers: ArtistMatch[];
  legKm: number;
}

export interface TourPlan {
  mode: "live" | "sample";
  artist: ArtistMatch;
  alternatives: ArtistMatch[];
  region: RegionFilter;
  stops: Stop[];
  ranked: { city: City; score: CityScore }[];
  demographics: Demographics | null;
  demographicsNote?: string;
  totalKm: number;
  reasonsBy: "llm" | "template";
  model?: string;
}

export interface BaselineStop {
  city: string;
  country: string;
  lat: number;
  lng: number;
  reason: string;
  venues: string[];
  openers: string[];
}

export interface BaselinePlan {
  stops: BaselineStop[];
  model: string;
}

export type AgentEvent =
  | { type: "step"; step: StepId; status: "active" | "done"; detail?: string }
  | { type: "artist"; artist: ArtistMatch; alternatives: ArtistMatch[] }
  | { type: "progress"; done: number; total: number }
  | { type: "debug"; entry: QlooDebugEntry }
  | { type: "plan"; plan: TourPlan }
  | { type: "error"; message: string };
