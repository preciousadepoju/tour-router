"use client";

import { useEffect, useState } from "react";
import { REGION_LABELS, type RegionFilter } from "@/lib/cities";
import type { PlanRequest } from "@/lib/plan-types";

const REGIONS: RegionFilter[] = ["all", "us", "europe", "africa"];
const SHORT: Record<RegionFilter, string> = { all: "World", us: "US", europe: "UK/EU", africa: "Africa" };

const EXAMPLES: { artist: string; note: string; region: RegionFilter }[] = [
  { artist: "Tems", note: "Alté · R&B", region: "all" },
  { artist: "Asake", note: "Afrobeats × Amapiano", region: "europe" },
  { artist: "Tyla", note: "Popiano", region: "us" },
];

interface Props {
  initial: PlanRequest | null;
  busy: boolean;
  compact?: boolean;
  onSubmit: (req: PlanRequest) => void;
}

export function PlanForm({ initial, busy, compact, onSubmit }: Props) {
  const [artist, setArtist] = useState(initial?.artist ?? "");
  const [region, setRegion] = useState<RegionFilter>(initial?.region ?? "all");
  const [stops, setStops] = useState(initial?.stops ?? 6);

  // Keep the compact form in sync when a run is started elsewhere (e.g. picking another match).
  useEffect(() => {
    if (!initial) return;
    setArtist(initial.artist);
    setRegion(initial.region);
    setStops(initial.stops);
  }, [initial]);

  const submit = (req: Partial<PlanRequest> = {}) => {
    const next = { artist: artist.trim(), region, stops, ...req };
    if (next.artist) onSubmit(next);
  };

  if (compact) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3 rounded-2xl border border-line bg-ink-2/80 p-3 backdrop-blur sm:flex-row sm:items-center"
      >
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          aria-label="Artist"
          className="min-w-0 flex-1 rounded-xl bg-ink-3 px-4 py-2.5 font-display text-lg font-semibold outline-none placeholder:text-paper-3 focus:ring-2 focus:ring-stage"
        />
        <div className="flex gap-3">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionFilter)}
            aria-label="Region"
            className="min-w-0 flex-1 rounded-xl bg-ink-3 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-stage sm:flex-none"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {SHORT[r]}
              </option>
            ))}
          </select>
          <Stepper value={stops} onChange={setStops} small />
          <SubmitButton busy={busy} small />
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="relative overflow-hidden rounded-[28px] border border-line bg-ink-2 p-6 shadow-[0_30px_80px_-30px_#000] sm:p-8"
    >
      {/* ticket notch */}
      <span aria-hidden className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink" />
      <span aria-hidden className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink" />

      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper-3">Artist</span>
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="e.g. Tems, Asake, Tyla…"
          autoFocus
          className="mt-2 w-full border-b-2 border-line bg-transparent pb-3 focus-visible:outline-none font-display text-3xl font-bold tracking-tight outline-none transition-colors placeholder:text-paper-3/50 focus:border-stage sm:text-4xl"
        />
      </label>

      <div className="mt-7">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper-3">Region</span>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Region">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={region === r}
              onClick={() => setRegion(r)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                region === r
                  ? "border-stage bg-stage-soft text-paper"
                  : "border-line text-paper-2 hover:border-paper-3"
              }`}
            >
              {REGION_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-end justify-between gap-5 border-t border-dashed border-line pt-6">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper-3">Stops</span>
          <div className="mt-2">
            <Stepper value={stops} onChange={setStops} />
          </div>
        </div>
        <SubmitButton busy={busy} />
      </div>

      <div className="mt-7">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper-3">Or try one</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.artist}
              type="button"
              onClick={() => {
                setArtist(ex.artist);
                setRegion(ex.region);
                submit({ artist: ex.artist, region: ex.region });
              }}
              className="group rounded-full border border-line px-4 py-2 text-left transition hover:border-stage hover:bg-stage-soft"
            >
              <span className="font-semibold">{ex.artist}</span>
              <span className="ml-2 text-xs text-paper-3 group-hover:text-paper-2">
                {ex.note} · {REGION_LABELS[ex.region]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

function Stepper({ value, onChange, small }: { value: number; onChange: (n: number) => void; small?: boolean }) {
  const btn = `grid place-items-center rounded-lg bg-ink-3 text-lg font-bold transition hover:bg-line disabled:opacity-30 ${
    small ? "h-10 w-9" : "h-11 w-11"
  }`;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Number of stops">
      <button type="button" className={btn} onClick={() => onChange(Math.max(2, value - 1))} disabled={value <= 2} aria-label="Fewer stops">
        −
      </button>
      <span className={`text-center font-mono font-bold tabular-nums ${small ? "w-7 text-base" : "w-12 text-2xl"}`} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(12, value + 1))} disabled={value >= 12} aria-label="More stops">
        +
      </button>
    </div>
  );
}

function SubmitButton({ busy, small }: { busy: boolean; small?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={`group inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-stage font-display font-bold text-ink shadow-[0_10px_30px_-10px_#ff5b2e] transition hover:brightness-110 active:translate-y-px disabled:cursor-wait disabled:opacity-60 ${
        small ? "px-4 py-2.5 text-sm" : "px-7 py-4 text-lg"
      }`}
    >
      {busy ? "Planning…" : "Plan tour"}
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="transition-transform group-hover:translate-x-0.5">
        <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
