"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type TabId = "events" | "lineups" | "stats" | "h2h" | "standings" | "analysis";

export const TABS: { id: TabId; label: string }[] = [
  { id: "events", label: "Diễn biến" },
  { id: "lineups", label: "Đội hình" },
  { id: "stats", label: "Thống kê" },
  { id: "h2h", label: "Đối đầu" },
  { id: "standings", label: "BXH" },
  { id: "analysis", label: "Nhận định" },
];

interface Props {
  activeTab: TabId;
}

export default function MatchTabs({ activeTab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function navigate(tab: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="sticky top-14 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="mx-auto max-w-screen-xl">
        <div className="site-panel-soft p-1.5 sm:p-2">
          <div
            className="flex gap-1 overflow-x-auto no-scrollbar sm:gap-2"
            role="tablist"
            aria-label="Match sections"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.id)}
                  disabled={isPending}
                  role="tab"
                  aria-selected={active}
                  className={`shrink-0 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm ${active ? "tab-active" : "tab-inactive"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
