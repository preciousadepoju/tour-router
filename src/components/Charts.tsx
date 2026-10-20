"use client";

import { useState } from "react";
import type { TourPlan } from "@/lib/plan-types";
import type { Demographics } from "@/lib/qloo/normalize";

/**
 * Demographic affinity: one diverging bar per bucket around zero. Blue = over-indexes,
 * red = under-indexes (validated pair for the dark surface); every bar is labelled with its
 * value so polarity never relies on color alone.
 */
export function DemographicsPanel({ demographics, note }: { demographics: Demographics | null; note?: string }) {
  const [table, setTable] = useState(false);

  return (
    <section className="rounded-3xl border border-line bg-ink-2 p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold">Who the audience is</h3>
          <p className="mt-1 text-sm text-paper-3">Qloo demographic affinity, −1 (under-indexes) to +1 (over-indexes)</p>
        </div>
        {demographics && (
          <button onClick={() => setTable((t) => !t)} className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-mono text-[11px] text-paper-2 hover:border-paper-3">
            {table ? "Chart" : "Table"}
          </button>
        )}
      </header>

      {!demographics ? (
        <p className="mt-5 rounded-xl bg-ink-3 p-4 text-sm text-paper-2">{note ?? "No demographic data."}</p>
      ) : table ? (
        <table className="mt-5 w-full text-sm">
          <thead className="text-left font-mono text-[11px] uppercase tracking-[0.12em] text-paper-3">
            <tr>
              <th className="py-1 font-normal">Group</th>
              <th className="py-1 text-right font-normal">Affinity</th>
            </tr>
          </thead>
          <tbody>
            {[...demographics.age, ...demographics.gender].map((r) => (
              <tr key={r.bucket} className="border-t border-line">
                <td className="py-1.5 capitalize">{r.bucket}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">{fmt(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-5 space-y-5">
          <Diverging label="Age" rows={demographics.age} />
          <Diverging label="Gender" rows={demographics.gender} />
          <div className="flex gap-4 font-mono text-[11px] text-paper-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-data-pos" /> over-indexes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-data-neg" /> under-indexes
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function Diverging({ label, rows }: { label: string; rows: { bucket: string; value: number }[] }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-paper-3">{label}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const v = Math.max(-1, Math.min(1, r.value));
          const pct = Math.abs(v) * 50;
          return (
            <li key={r.bucket} className="group grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-sm" title={`${r.bucket}: ${fmt(r.value)}`}>
              <span className="capitalize text-paper-2">{r.bucket}</span>
              <span className="relative h-3.5">
                <span className="absolute inset-y-0 left-1/2 w-px bg-data-mid" />
                <span
                  className={`absolute inset-y-0 ${v >= 0 ? "rounded-r bg-data-pos" : "rounded-l bg-data-neg"} transition-opacity group-hover:opacity-80`}
                  style={v >= 0 ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }}
                />
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-paper-2">{fmt(r.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Every scored city as a horizontal bar. Cities on the tour use the highlight color and
 * carry their stop number; the rest are neutral context.
 */
export function CityRanking({ plan, limit = 15 }: { plan: TourPlan; limit?: number }) {
  const [all, setAll] = useState(false);
  const stopOf = new Map(plan.stops.map((s) => [s.city.id, s.order]));
  const rows = all ? plan.ranked : plan.ranked.slice(0, limit);
  const max = Math.max(...plan.ranked.map((r) => r.score.score), 1);

  return (
    <section className="rounded-3xl border border-line bg-ink-2 p-5 sm:p-6">
      <h3 className="font-display text-xl font-bold">How every city scored</h3>
      <p className="mt-1 text-sm text-paper-3">
        {plan.ranked.length} cities scored by Qloo place affinity. Highlighted bars made the tour.
      </p>
      <ol className="mt-5 space-y-1">
        {rows.map((r, i) => {
          const stop = stopOf.get(r.city.id);
          return (
            <li
              key={r.city.id}
              className="grid grid-cols-[1.5rem_6.5rem_1fr_2.75rem] items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-ink-3"
              title={`${r.city.name}: score ${r.score.score.toFixed(1)}, ${r.score.matches} matches, affinity ${r.score.strength.toFixed(2)}`}
            >
              <span className="font-mono text-[11px] tabular-nums text-paper-3">{i + 1}</span>
              <span className={`truncate ${stop ? "font-semibold text-paper" : "text-paper-2"}`}>{r.city.name}</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`block h-2.5 rounded-r ${stop ? "bg-data-hi" : "bg-data-rest"}`}
                  style={{ width: `${(r.score.score / max) * 100}%` }}
                />
                {stop && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-stage px-1 font-mono text-[10px] font-bold text-ink">
                    {stop}
                  </span>
                )}
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-paper-2">{r.score.score.toFixed(1)}</span>
            </li>
          );
        })}
      </ol>
      {plan.ranked.length > limit && (
        <button onClick={() => setAll((a) => !a)} className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-stage hover:underline">
          {all ? "Show top 15" : `Show all ${plan.ranked.length}`}
        </button>
      )}
    </section>
  );
}

const fmt = (n: number) => (n > 0 ? "+" : "") + n.toFixed(2);
