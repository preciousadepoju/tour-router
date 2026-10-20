"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { REGION_LABELS } from "@/lib/cities";
import type { BaselinePlan, PlanRequest, TourPlan } from "@/lib/plan-types";
import type { ArtistMatch } from "@/lib/qloo/normalize";
import { CityRanking, DemographicsPanel } from "./Charts";
import { StopCard } from "./StopCard";
import type { BaselineState } from "./TourApp";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-ink-3" />,
});

type View = "with" | "without" | "split";

interface Props {
  plan: TourPlan;
  request: PlanRequest;
  llm: boolean;
  baseline: BaselineState;
  onLoadBaseline: () => void;
  onPickArtist: (a: ArtistMatch) => void;
}

export function Results({ plan, request, llm, baseline, onLoadBaseline, onPickArtist }: Props) {
  const [view, setView] = useState<View>("with");
  const [active, setActive] = useState<number | null>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (view !== "with") onLoadBaseline();
  }, [view, onLoadBaseline]);

  const mapStops = plan.stops.map((s) => ({
    lat: s.city.lat,
    lng: s.city.lng,
    title: s.city.name,
    subtitle: `Score ${s.score.score.toFixed(1)} · ${s.venues[0]?.name ?? ""}`,
  }));

  return (
    <div className="space-y-6">
      <ArtistHeader plan={plan} request={request} onPickArtist={onPickArtist} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ViewToggle view={view} onChange={setView} />
        <p className="font-mono text-[11px] text-paper-3">
          {plan.reasonsBy === "llm" ? `Reasons written by ${plan.model} from Qloo signals` : "Template reasons (no LLM key set)"}
        </p>
      </div>

      {view === "with" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="h-[340px] overflow-hidden rounded-3xl border border-line sm:h-[440px] lg:h-[calc(100dvh-8rem)] lg:max-h-[720px]">
              <RouteMap
                stops={mapStops}
                active={active}
                onSelect={(i) => {
                  setActive(i);
                  cards.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </div>
          </div>
          <div className="space-y-4">
            {plan.stops.map((s, i) => (
              <StopCard
                key={s.city.id}
                ref={(el) => {
                  cards.current[i] = el;
                }}
                stop={s}
                total={plan.ranked.length}
                active={active === i}
                onFocus={() => setActive(i)}
              />
            ))}
          </div>
          <div className="grid gap-6 lg:col-span-2 lg:grid-cols-2">
            <DemographicsPanel demographics={plan.demographics} note={plan.demographicsNote} />
            <CityRanking plan={plan} />
          </div>
        </div>
      )}

      {view === "without" && <BaselineColumn state={baseline} llm={llm} wide />}

      {view === "split" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <ColumnHeading tone="with" title="With Qloo" note="Ranked by local taste affinity, routed by distance" />
            <div className="h-64 overflow-hidden rounded-3xl border border-line">
              <RouteMap stops={mapStops} />
            </div>
            <ol className="mt-4 space-y-3">
              {plan.stops.map((s) => (
                <CompactStop
                  key={s.city.id}
                  n={s.order}
                  city={`${s.city.name}, ${s.city.country}`}
                  meta={`score ${s.score.score.toFixed(1)} · ${s.score.matches} matches · affinity ${s.score.strength.toFixed(2)}`}
                  reason={s.reason}
                  venues={s.venues.map((v) => v.name)}
                  openers={s.openers.map((o) => o.name)}
                />
              ))}
            </ol>
          </section>
          <BaselineColumn state={baseline} llm={llm} />
        </div>
      )}
    </div>
  );
}

function ArtistHeader({ plan, request, onPickArtist }: { plan: TourPlan; request: PlanRequest; onPickArtist: (a: ArtistMatch) => void }) {
  return (
    <section className="rise flex flex-col gap-5 rounded-3xl border border-line bg-ink-2 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper-3">
          {REGION_LABELS[request.region]} tour · {plan.stops.length} stops
        </p>
        <h2 className="mt-1 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-none tracking-[-0.03em]">
          {plan.artist.name}
        </h2>
        <p className="mt-2 text-sm text-paper-2">
          Matched in Qloo{plan.artist.description ? ` as “${plan.artist.description}”` : ""}
          <span className="ml-2 font-mono text-[11px] text-paper-3">{plan.artist.id}</span>
        </p>
        {plan.alternatives.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-paper-3">Not the right artist?</span>
            {plan.alternatives.map((a) => (
              <button
                key={a.id}
                onClick={() => onPickArtist(a)}
                className="rounded-full border border-line px-3 py-1 text-paper-2 transition hover:border-stage hover:text-paper"
                title={a.description}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-6 lg:text-right">
        <Stat label="Stops" value={String(plan.stops.length)} />
        <Stat label="Route" value={`${Math.round(plan.totalKm).toLocaleString()} km`} />
        <Stat label="Cities scored" value={String(plan.ranked.length)} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper-3">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: [View, string][] = [
    ["with", "With Qloo"],
    ["without", "Without Qloo"],
    ["split", "Side by side"],
  ];
  return (
    <div role="tablist" aria-label="Compare plans" className="inline-flex w-full rounded-2xl border border-line bg-ink-2 p-1 sm:w-auto">
      {opts.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          onClick={() => onChange(v)}
          className={`flex-1 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-semibold transition sm:flex-none sm:px-4 ${
            view === v ? (v === "without" ? "bg-paper text-ink" : "bg-stage text-ink") : "text-paper-2 hover:text-paper"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ColumnHeading({ tone, title, note }: { tone: "with" | "without"; title: string; note: string }) {
  return (
    <header className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="flex items-center gap-2 font-display text-xl font-bold">
        <span className={`h-2.5 w-2.5 rounded-full ${tone === "with" ? "bg-stage" : "bg-paper-2"}`} />
        {title}
      </h3>
      <span className="text-right text-xs text-paper-3">{note}</span>
    </header>
  );
}

function BaselineColumn({ state, llm, wide }: { state: BaselineState; llm: boolean; wide?: boolean }) {
  return (
    <section>
      <ColumnHeading tone="without" title="Without Qloo" note="Same question, LLM general knowledge only" />
      {!llm ? (
        <Notice>
          The LLM-only comparison needs <code className="font-mono text-paper">ANTHROPIC_API_KEY</code> on the server. Add it
          to <code className="font-mono text-paper">.env.local</code> and restart to see the two plans side by side.
        </Notice>
      ) : state.status === "loading" || state.status === "idle" ? (
        <div className="space-y-3">
          <div className={`animate-pulse rounded-3xl bg-ink-2 ${wide ? "h-80" : "h-64"}`} />
          <p className="font-mono text-[11px] text-paper-3">Asking the LLM to plan the same tour without Qloo…</p>
        </div>
      ) : state.status === "error" ? (
        <Notice>{state.message}</Notice>
      ) : (
        <BaselineBody plan={state.plan} wide={wide} />
      )}
    </section>
  );
}

function BaselineBody({ plan, wide }: { plan: BaselinePlan; wide?: boolean }) {
  const stops = plan.stops.map((s) => ({ lat: s.lat, lng: s.lng, title: s.city, subtitle: s.country }));
  return (
    <>
      <div className={`overflow-hidden rounded-3xl border border-line ${wide ? "h-80 sm:h-96" : "h-64"}`}>
        <RouteMap stops={stops} muted />
      </div>
      <ol className={`mt-4 grid gap-3 ${wide ? "md:grid-cols-2" : ""}`}>
        {plan.stops.map((s, i) => (
          <CompactStop
            key={`${s.city}-${i}`}
            n={i + 1}
            muted
            city={`${s.city}, ${s.country}`}
            meta="no audience signal · general knowledge"
            reason={s.reason}
            venues={s.venues}
            openers={s.openers}
          />
        ))}
      </ol>
      <p className="mt-3 font-mono text-[11px] text-paper-3">Generated by {plan.model}. Venues and openers are unverified.</p>
    </>
  );
}

function CompactStop(props: {
  n: number;
  city: string;
  meta: string;
  reason: string;
  venues: string[];
  openers: string[];
  muted?: boolean;
}) {
  return (
    <li className="rounded-2xl border border-line bg-ink-2 p-4">
      <div className="flex items-baseline gap-3">
        <span className={`font-display text-2xl font-extrabold tabular-nums ${props.muted ? "text-paper-3" : "text-stage"}`}>
          {String(props.n).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{props.city}</p>
          <p className="font-mono text-[11px] text-paper-3">{props.meta}</p>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-paper-2">{props.reason}</p>
      <p className="mt-2 text-xs text-paper-3">
        <span className="text-paper-2">Venues:</span> {props.venues.join(", ") || "—"} · <span className="text-paper-2">Openers:</span>{" "}
        {props.openers.join(", ") || "—"}
      </p>
    </li>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-dashed border-line bg-ink-2 p-6 text-sm leading-relaxed text-paper-2">{children}</div>;
}
