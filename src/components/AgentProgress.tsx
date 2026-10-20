"use client";

import { STEP_LABELS, type StepId } from "@/lib/plan-types";
import type { ArtistMatch } from "@/lib/qloo/normalize";

export interface StepState {
  status: "pending" | "active" | "done";
  detail?: string;
}

const ORDER: StepId[] = ["resolve", "score", "route", "enrich", "reasons"];

const SOURCE: Record<StepId, string> = {
  resolve: "Qloo /search",
  score: "Qloo /v2/insights × city",
  route: "nearest-neighbour + 2-opt",
  enrich: "Qloo /v2/insights",
  reasons: "LLM, explain only",
};

export function AgentProgress({
  steps,
  progress,
  artist,
}: {
  steps: Record<StepId, StepState>;
  progress: { done: number; total: number } | null;
  artist: ArtistMatch | null;
}) {
  return (
    <section aria-live="polite" className="rise mx-auto max-w-2xl rounded-3xl border border-line bg-ink-2 p-6 sm:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper-3">Agent at work</p>
      <h2 className="mt-2 font-display text-2xl font-bold">
        {artist ? (
          <>
            Routing <span className="text-stage">{artist.name}</span>
          </>
        ) : (
          "Finding the artist…"
        )}
      </h2>

      <ol className="mt-6 space-y-1">
        {ORDER.map((id, i) => {
          const s = steps[id];
          return (
            <li
              key={id}
              className={`flex items-start gap-4 rounded-xl px-3 py-3 transition-colors ${s.status === "active" ? "bg-ink-3" : ""}`}
            >
              <StepIcon status={s.status} index={i + 1} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className={`font-semibold ${s.status === "pending" ? "text-paper-3" : ""}`}>{STEP_LABELS[id]}</span>
                  <span className="font-mono text-[11px] text-paper-3">{SOURCE[id]}</span>
                </div>
                {s.detail && <p className="mt-0.5 text-sm text-paper-2">{s.detail}</p>}
                {id === "score" && s.status === "active" && progress && (
                  <div className="mt-2.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink">
                      <div
                        className="h-full rounded-full bg-stage transition-[width] duration-300"
                        style={{ width: `${(progress.done / progress.total) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[11px] tabular-nums text-paper-3">
                      {progress.done}/{progress.total} cities scored
                    </p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepIcon({ status, index }: { status: StepState["status"]; index: number }) {
  if (status === "done") {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stage text-ink" aria-label="done">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-stage" aria-label="in progress">
        <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-stage" />
      </span>
    );
  }
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line font-mono text-xs text-paper-3" aria-label="pending">
      {index}
    </span>
  );
}
