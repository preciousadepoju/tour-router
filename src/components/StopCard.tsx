"use client";

import { forwardRef } from "react";
import type { Stop } from "@/lib/plan-types";

interface Props {
  stop: Stop;
  total: number;
  active: boolean;
  onFocus: () => void;
}

export const StopCard = forwardRef<HTMLElement, Props>(function StopCard({ stop, total, active, onFocus }, ref) {
  return (
    <article
      ref={ref}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      tabIndex={0}
      className={`rise relative scroll-mt-24 overflow-hidden rounded-3xl border bg-ink-2 p-5 outline-none transition-colors sm:p-6 ${
        active ? "border-stage/70" : "border-line hover:border-paper-3/40"
      }`}
      style={{ animationDelay: `${stop.order * 60}ms` }}
    >
      <div className="flex items-start gap-4">
        <span className="font-display text-5xl font-extrabold leading-none tracking-tighter text-stage tabular-nums">
          {String(stop.order).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-2xl font-bold leading-tight tracking-tight">{stop.city.name}</h3>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper-3">
                {stop.city.country}
                {stop.legKm > 0 && <> · {stop.legKm.toLocaleString()} km from stop {stop.order - 1}</>}
              </p>
            </div>
            <ScoreBadge score={stop.score.score} rank={stop.rank} total={total} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-paper-2">{stop.reason}</p>

      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-paper-3">
        <div>
          <dt className="inline">matches </dt>
          <dd className="inline text-paper">{stop.score.matches}</dd>
        </div>
        <div>
          <dt className="inline">mean affinity </dt>
          <dd className="inline text-paper">{stop.score.strength.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="inline">popularity </dt>
          <dd className="inline text-paper">{stop.score.pull.toFixed(2)}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 border-t border-dashed border-line pt-5 sm:grid-cols-3">
        <Column title="Venues" empty="No venue-type matches">
          {stop.venues.map((v) => (
            <li key={v.id}>
              <span className="block font-medium leading-snug">{v.name}</span>
              <AffinityBar value={v.affinity} />
            </li>
          ))}
        </Column>
        <Column title="Openers" empty="No similar artists returned">
          {stop.openers.map((o) => (
            <li key={o.id} className="font-medium leading-snug">
              {o.name}
            </li>
          ))}
        </Column>
        <Column title="After the show" empty="No food & drink matches">
          {stop.afterShow.map((v) => (
            <li key={v.id}>
              <span className="block font-medium leading-snug">{v.name}</span>
              {v.tags.length > 0 && <span className="text-xs text-paper-3">{v.tags.slice(0, 2).join(" · ")}</span>}
            </li>
          ))}
        </Column>
      </div>
    </article>
  );
});

function ScoreBadge({ score, rank, total }: { score: number; rank: number; total: number }) {
  return (
    <div className="rounded-2xl border border-line bg-ink px-3 py-1.5 text-right" title={`Ranked ${rank} of ${total} candidate cities`}>
      <div className="font-mono text-lg font-bold leading-tight tabular-nums">{score.toFixed(1)}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper-3">
        #{rank} of {total}
      </div>
    </div>
  );
}

function Column({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div>
      <h4 className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-paper-3">{title}</h4>
      {children.length ? <ul className="space-y-2.5 text-sm">{children}</ul> : <p className="text-sm text-paper-3">{empty}</p>}
    </div>
  );
}

function AffinityBar({ value }: { value: number }) {
  return (
    <span className="mt-1 flex items-center gap-2" title={`Qloo affinity ${value.toFixed(2)}`}>
      <span className="h-1 w-16 overflow-hidden rounded-full bg-ink-3">
        <span className="block h-full rounded-full bg-data-hi" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="font-mono text-[10px] tabular-nums text-paper-3">{value.toFixed(2)}</span>
    </span>
  );
}
