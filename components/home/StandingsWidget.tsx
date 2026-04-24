"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import LogoMark from "@/components/LogoMark";
import type { DbLeagueStandings, DbStandingsGroup } from "@/lib/db-queries";

function shortGroupLabel(label: string) {
  // API trả label kiểu "World Cup - Group A" hay "UEFA Champions League - Group A".
  // Chỉ hiển thị phần "Group A" cho gọn.
  const match = /(Group\s+[A-Z0-9]+)/i.exec(label);
  return match ? match[1] : label;
}

export default function StandingsWidget({ groups }: { groups: DbLeagueStandings[] }) {
  const available = useMemo(
    () => groups.filter((group) => group.groups.length > 0),
    [groups]
  );

  const [activeId, setActiveId] = useState<number | null>(available[0]?.league.id ?? null);
  const [activeGroupLabel, setActiveGroupLabel] = useState<string | null>(null);

  const active = useMemo(
    () => available.find((group) => group.league.id === activeId) ?? available[0] ?? null,
    [available, activeId]
  );

  const activeIndex = active ? available.findIndex((g) => g.league.id === active.league.id) : -1;

  const activeGroup: DbStandingsGroup | null = useMemo(() => {
    if (!active) return null;
    if (active.groups.length === 0) return null;
    const matched = active.groups.find((group) => group.label === activeGroupLabel);
    return matched ?? active.groups[0];
  }, [active, activeGroupLabel]);

  const goLeague = (delta: number) => {
    if (activeIndex < 0) return;
    const next = (activeIndex + delta + available.length) % available.length;
    setActiveId(available[next].league.id);
    setActiveGroupLabel(null);
  };

  return (
    <aside id="standings" className="site-panel scroll-mt-32 overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(255,255,255,0.03) 65%, rgba(15,23,42,0.12))",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Bảng tổng quan
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">Bảng xếp hạng</h2>
          </div>
          <Link
            href="/bang-xep-hang"
            className="text-sm font-semibold text-orange-200 transition hover:text-white"
          >
            Xem toàn bộ
          </Link>
        </div>
      </div>

      {available.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">
          Chưa có dữ liệu bảng xếp hạng cho nhóm giải này.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <button
              type="button"
              onClick={() => goLeague(-1)}
              aria-label="Giải trước"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-40"
              disabled={available.length < 2}
            >
              ←
            </button>

            <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
              {available.map((group) => {
                const isActive = group.league.id === active?.league.id;
                return (
                  <button
                    key={group.league.id}
                    type="button"
                    onClick={() => {
                      setActiveId(group.league.id);
                      setActiveGroupLabel(null);
                    }}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      isActive
                        ? "border-orange-400/30 bg-orange-500/15 text-white"
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                    }`}
                  >
                    <LogoMark src={group.league.logo_url ?? ""} alt="" size={12} />
                    <span className="max-w-[120px] truncate">{group.league.name}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => goLeague(1)}
              aria-label="Giải kế tiếp"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-40"
              disabled={available.length < 2}
            >
              →
            </button>
          </div>

          {active ? (
            <>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <Link
                  href={`/league/${active.league.id}?section=fixtures`}
                  className="group flex min-w-0 items-center gap-2"
                >
                  <LogoMark src={active.league.logo_url ?? ""} alt="" size={20} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white group-hover:text-orange-200">
                      {active.league.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {active.league.country?.name ?? "Quốc tế"} · Bấm để xem lịch thi đấu
                    </p>
                  </div>
                </Link>
                <Link
                  href={`/league/${active.league.id}?section=standings`}
                  className="shrink-0 text-[11px] font-semibold text-slate-300 transition hover:text-white"
                >
                  BXH đầy đủ →
                </Link>
              </div>

              {active.groups.length > 1 ? (
                <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10 px-4 pb-3">
                  {active.groups.map((group) => {
                    const key = group.label ?? "__default";
                    const label = group.label ? shortGroupLabel(group.label) : "Tổng";
                    const isActive =
                      (activeGroup?.label ?? null) === group.label;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveGroupLabel(group.label)}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                          isActive
                            ? "border-orange-400/30 bg-orange-500/15 text-white"
                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500">
                    <th className="w-8 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">
                      #
                    </th>
                    <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Đội
                    </th>
                    <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">
                      Đ
                    </th>
                    <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">
                      HS
                    </th>
                    <th className="w-12 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200">
                      PT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(activeGroup?.entries ?? []).slice(0, 8).map((entry) => (
                    <tr
                      key={entry.team_id}
                      className="border-b border-white/5 transition hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3 text-sm text-slate-500">{entry.rank}</td>
                      <td className="py-3">
                        <Link
                          href={`/team/${entry.team_id}`}
                          className="flex items-center gap-2 transition hover:text-orange-200"
                        >
                          <LogoMark src={entry.team.logo_url ?? ""} alt="" size={18} />
                          <span className="max-w-[140px] truncate font-medium text-slate-100">
                            {entry.team.name}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 text-center text-slate-400">{entry.played}</td>
                      <td
                        className={`py-3 text-center ${
                          entry.goals_diff > 0
                            ? "text-emerald-300"
                            : entry.goals_diff < 0
                              ? "text-red-300"
                              : "text-slate-500"
                        }`}
                      >
                        {entry.goals_diff > 0 ? `+${entry.goals_diff}` : entry.goals_diff}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-white">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </>
      )}
    </aside>
  );
}
