"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type TabId = "events" | "lineups" | "stats" | "analysis";

export const TABS: { id: TabId; label: string }[] = [
  { id: "events", label: "Diễn biến" },
  { id: "lineups", label: "Đội hình" },
  { id: "stats", label: "Thống kê" },
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
    <div className="sticky top-[104px] z-30 px-4 pt-4 lg:top-[88px]">
      <div className="mx-auto max-w-screen-xl">
        <div className="site-panel-soft p-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigate(tab.id)}
                disabled={isPending}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab.id ? "tab-active" : "tab-inactive"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
