"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, BaselinePlan, PlanRequest, StepId, TourPlan } from "@/lib/plan-types";
import type { ArtistMatch } from "@/lib/qloo/normalize";
import type { QlooDebugEntry } from "@/lib/qloo/types";
import { AgentProgress, type StepState } from "./AgentProgress";
import { DebugPanel } from "./DebugPanel";
import { PlanForm } from "./PlanForm";
import { Results } from "./Results";
import { SampleBanner } from "./SampleBanner";

interface Props {
  mode: "live" | "sample";
  llm: boolean;
  debug: boolean;
}

export type BaselineState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; plan: BaselinePlan }
  | { status: "error"; message: string };

const EMPTY_STEPS: Record<StepId, StepState> = {
  resolve: { status: "pending" },
  score: { status: "pending" },
  route: { status: "pending" },
  enrich: { status: "pending" },
  reasons: { status: "pending" },
};

export function TourApp({ mode, llm, debug }: Props) {
  const [request, setRequest] = useState<PlanRequest | null>(null);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(EMPTY_STEPS);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [artist, setArtist] = useState<ArtistMatch | null>(null);
  const [plan, setPlan] = useState<TourPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<BaselineState>({ status: "idle" });
  const [debugLog, setDebugLog] = useState<QlooDebugEntry[]>([]);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (req: PlanRequest) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;

    setRequest(req);
    setRunning(true);
    setSteps(EMPTY_STEPS);
    setProgress(null);
    setArtist(null);
    setPlan(null);
    setError(null);
    setBaseline({ status: "idle" });
    setDebugLog([]);

    const handle = (e: AgentEvent) => {
      switch (e.type) {
        case "step":
          setSteps((s) => ({ ...s, [e.step]: { status: e.status, detail: e.detail } }));
          break;
        case "progress":
          setProgress({ done: e.done, total: e.total });
          break;
        case "artist":
          setArtist(e.artist);
          break;
        case "debug":
          setDebugLog((log) => [...log, e.entry]);
          break;
        case "plan":
          setPlan(e.plan);
          break;
        case "error":
          setError(e.message);
          break;
      }
    };

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as AgentEvent);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      if (abort.current === ctrl) setRunning(false);
    }
  }, []);

  // Shareable links: ?artist=Tems&region=all&stops=6 starts a run on load.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const a = q.get("artist")?.trim();
    if (!a) return;
    const region = (["all", "us", "europe", "africa"] as const).find((r) => r === q.get("region")) ?? "all";
    run({ artist: a, region, stops: Math.min(12, Math.max(2, Number(q.get("stops")) || 6)) });
  }, [run]);

  useEffect(() => {
    if (!request) return;
    const q = new URLSearchParams({ artist: request.artist, region: request.region, stops: String(request.stops) });
    window.history.replaceState(null, "", `?${q}`);
  }, [request]);

  const loadBaseline = useCallback(async () => {
    // Fetch once per plan; an error stays visible instead of retrying in a loop.
    if (!llm || !request || baseline.status !== "idle") return;
    setBaseline({ status: "loading" });
    try {
      const res = await fetch("/api/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setBaseline({ status: "done", plan: body as BaselinePlan });
    } catch (err) {
      setBaseline({ status: "error", message: (err as Error).message });
    }
  }, [llm, request, baseline.status]);

  const reset = () => {
    abort.current?.abort();
    window.history.replaceState(null, "", window.location.pathname);
    setRequest(null);
    setPlan(null);
    setError(null);
    setRunning(false);
  };

  const started = request !== null;

  return (
    <div className="flex min-h-dvh flex-col">
      {mode === "sample" && <SampleBanner />}

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <button onClick={reset} className="group flex items-center gap-3 text-left" aria-label="Tour Router home">
          <Logo />
          <span className="font-display text-xl font-extrabold tracking-tight">
            Tour<span className="text-stage">/</span>Router
          </span>
        </button>
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-3">
          <span className={`h-2 w-2 rounded-full ${mode === "live" ? "bg-emerald-400" : "bg-tape"}`} />
          {mode === "live" ? "Live Qloo data" : "Sample mode"}
          <span className="hidden sm:inline">· Qloo taste graph</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 sm:px-8">
        {!started && <Landing onSubmit={run} />}

        {started && (
          <div className="space-y-8">
            <PlanForm compact initial={request} busy={running} onSubmit={run} />

            {(running || !plan) && !error && (
              <AgentProgress steps={steps} progress={progress} artist={artist} />
            )}

            {error && (
              <div role="alert" className="rise rounded-2xl border border-stage/40 bg-stage-soft p-5">
                <p className="font-display text-lg font-bold">The agent hit a wall.</p>
                <p className="mt-1 text-paper-2">{error}</p>
              </div>
            )}

            {plan && request && (
              <Results
                plan={plan}
                request={request}
                llm={llm}
                baseline={baseline}
                onLoadBaseline={loadBaseline}
                onPickArtist={(a) => run({ ...request, artist: a.name, entityId: a.id })}
              />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-line px-4 py-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-paper-3 sm:px-8">
        Built for the Qloo Agentic Hackathon · MIT licensed · Qloo ranks, the LLM only explains
      </footer>

      {debug && <DebugPanel entries={debugLog} />}
    </div>
  );
}

function Landing({ onSubmit }: { onSubmit: (req: PlanRequest) => void }) {
  return (
    <section className="grid gap-10 pt-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-14">
      <div className="rise">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-paper-2">
          <span className="h-1.5 w-1.5 rounded-full bg-stage" /> Tour planning agent
        </p>
        <h1 className="font-display text-[clamp(2.6rem,7vw,5.6rem)] font-extrabold leading-[0.92] tracking-[-0.035em]">
          Route the tour
          <br />
          to where the <span className="text-stage">fans</span>
          <br />
          already are.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper-2">
          Type an independent artist. The agent reads Qloo&apos;s taste graph to find the cities whose
          local scenes match that artist&apos;s audience, routes the shortest path between them, and
          books the night: venues, openers and somewhere to eat after.
        </p>
        <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
          {[
            ["40", "candidate cities"],
            ["250M+", "Qloo entities"],
            ["1", "toggle to see the difference"],
          ].map(([n, label]) => (
            <div key={label}>
              <dt className="font-display text-2xl font-bold">{n}</dt>
              <dd className="mt-1 text-sm text-paper-3">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rise [animation-delay:120ms]">
        <PlanForm initial={null} busy={false} onSubmit={onSubmit} />
      </div>
    </section>
  );
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden className="transition-transform group-hover:-rotate-6">
      <rect width="32" height="32" rx="9" fill="#17150f" stroke="#2f2b22" />
      <path d="M7 23 L13 11 L19 19 L25 8" fill="none" stroke="#ff5b2e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="23" r="2.6" fill="#f3ede2" />
      <circle cx="25" cy="8" r="2.6" fill="#ff5b2e" />
    </svg>
  );
}

