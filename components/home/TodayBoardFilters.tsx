"use client";

import { useState, type ReactNode } from "react";

export type FilterKey = "all" | "live" | "upcoming" | "finished";

type Counts = Record<FilterKey, number>;

const FILTERS: { key: FilterKey; label: string; tone: string }[] = [
  { key: "all", label: "Tất cả", tone: "text-slate-200" },
  { key: "live", label: "Live", tone: "text-red-200" },
  { key: "upcoming", label: "Sắp đá", tone: "text-orange-200" },
  { key: "finished", label: "FT", tone: "text-sky-200" },
];

export default function TodayBoardFilters({
  counts,
  children,
}: {
  counts: Counts;
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const emptyFilter = counts[filter] === 0;

  return (
    <section id="match-center" className="scroll-mt-32 space-y-3" data-filter={filter}>
      <div className="sticky top-[56px] z-30 -mx-4 border-b border-white/10 bg-[#07131f]/85 px-4 py-2 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:py-2">
        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          {FILTERS.map(({ key, label, tone }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                  active
                    ? "border-orange-400/30 bg-orange-500/15 text-white"
                    : `border-white/10 bg-white/[0.04] ${tone} hover:bg-white/[0.08]`
                }`}
              >
                {key === "live" ? <span className="live-dot" /> : null}
                {label}
                <span className={`score text-[11px] font-black ${active ? "text-white" : "text-slate-400"}`}>
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {emptyFilter ? (
        <div className="site-panel px-5 py-8 text-center text-sm text-slate-400">
          Không có trận nào ở bộ lọc này.
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}
