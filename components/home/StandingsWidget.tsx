import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import type { DbStanding } from "@/lib/db-queries";

export default function StandingsWidget({ standings }: { standings: DbStanding[] }) {
  return (
    <aside id="standings" className="site-panel scroll-mt-32 overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-4"
        style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(255,255,255,0.03) 65%, rgba(15,23,42,0.12))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Bảng tổng quan</p>
            <h2 className="mt-2 text-xl font-bold text-white">Bảng xếp hạng</h2>
          </div>
          <Link href="/#match-center" className="text-sm font-semibold text-orange-200 transition hover:text-white">
            Xem lịch hôm nay
          </Link>
        </div>
      </div>

      {standings.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">Chưa có dữ liệu bảng xếp hạng cho nhóm giải này.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-500">
              <th className="w-8 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">#</th>
              <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">Đội</th>
              <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">Đ</th>
              <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">HS</th>
              <th className="w-12 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200">PT</th>
            </tr>
          </thead>
          <tbody>
            {standings.slice(0, 8).map((entry) => (
              <tr key={entry.team_id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-sm text-slate-500">{entry.rank}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <LogoMark src={entry.team.logo_url ?? ""} alt="" size={18} />
                    <span className="max-w-[140px] truncate font-medium text-slate-100">{entry.team.name}</span>
                  </div>
                </td>
                <td className="py-3 text-center text-slate-400">{entry.played}</td>
                <td className={`py-3 text-center ${entry.goals_diff > 0 ? "text-emerald-300" : entry.goals_diff < 0 ? "text-red-300" : "text-slate-500"}`}>
                  {entry.goals_diff > 0 ? `+${entry.goals_diff}` : entry.goals_diff}
                </td>
                <td className="px-4 py-3 text-center font-bold text-white">{entry.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  );
}
