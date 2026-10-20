"use client";

import { useState } from "react";
import type { QlooDebugEntry } from "@/lib/qloo/types";

/** Dev-only drawer with every raw Qloo request/response from the last run. */
export function DebugPanel({ entries }: { entries: QlooDebugEntry[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const entry = entries[selected];

  return (
    <div className="fixed bottom-4 right-4 z-[1100] flex flex-col items-end">
      {open && (
        <div className="mb-2 flex h-[70dvh] w-[min(92vw,760px)] flex-col overflow-hidden rounded-2xl border border-line bg-ink shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-3">
            <span>Raw Qloo responses · {entries.length} calls</span>
            <span>dev only</span>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,15rem)_1fr]">
            <ul className="overflow-auto border-r border-line text-xs">
              {entries.map((e, i) => (
                <li key={i}>
                  <button
                    onClick={() => setSelected(i)}
                    className={`block w-full px-3 py-2 text-left font-mono hover:bg-ink-3 ${i === selected ? "bg-ink-3 text-paper" : "text-paper-2"}`}
                  >
                    <span className="block truncate">{e.endpoint}</span>
                    <span className="block truncate text-paper-3">
                      {String(e.params["filter.location.query"] ?? e.params["filter.type"] ?? e.params.query ?? "")}
                    </span>
                    <span className="text-paper-3">
                      {e.ms}ms{e.cached ? " · cached" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <pre className="overflow-auto p-3 font-mono text-[11px] leading-relaxed text-paper-2">
              {entry ? JSON.stringify({ params: entry.params, response: entry.response }, null, 2) : "Run a plan to see calls."}
            </pre>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-line bg-ink-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-2 shadow-lg hover:border-stage"
      >
        {open ? "Close debug" : `Debug · ${entries.length}`}
      </button>
    </div>
  );
}
