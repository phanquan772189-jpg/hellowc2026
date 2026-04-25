import Image from "next/image";

import LogoMark from "@/components/LogoMark";
import type { DbTeamCoach } from "@/lib/db-queries";

function formatYearRange(start: string | null, end: string | null) {
  const startYear = start ? new Date(start).getUTCFullYear() : null;
  const endYear = end ? new Date(end).getUTCFullYear() : null;

  if (!startYear) return endYear ? `… – ${endYear}` : "—";
  if (!endYear) return `${startYear} – nay`;
  if (startYear === endYear) return String(startYear);
  return `${startYear} – ${endYear}`;
}

function calcAge(birthDate: string | null) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const ageMs = Date.now() - birth.getTime();
  const years = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  return Number.isFinite(years) && years > 0 ? years : null;
}

export default function CoachCard({ coach, currentTeamId }: { coach: DbTeamCoach; currentTeamId: number }) {
  const age = calcAge(coach.birth_date);
  // Loại bỏ entry là chính team đang xem khỏi career timeline; entry hiện tại
  // đã được hiển thị ở header.
  const careerEntries = (coach.career ?? []).filter((entry) => entry.team.id !== currentTeamId);
  // Sort theo start mới → cũ
  const sortedCareer = [...careerEntries].sort((left, right) => {
    const leftTime = left.start ? new Date(left.start).getTime() : 0;
    const rightTime = right.start ? new Date(right.start).getTime() : 0;
    return rightTime - leftTime;
  });

  return (
    <section className="site-panel overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(56,189,248,0.16), rgba(255,255,255,0.03) 65%, rgba(15,23,42,0.12))",
        }}
      >
        <span className="section-label">Ban huấn luyện</span>
        <h2 className="mt-3 text-xl font-bold text-white">Huấn luyện viên trưởng</h2>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            {coach.photo_url ? (
              <Image src={coach.photo_url} alt={coach.name} fill className="object-cover" sizes="64px" unoptimized />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm text-slate-500">?</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-white">{coach.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-400">
              {coach.nationality ? <span className="fact-chip">{coach.nationality}</span> : null}
              {age ? <span className="fact-chip">{age} tuổi</span> : null}
              {coach.height_cm ? <span className="fact-chip">{coach.height_cm} cm</span> : null}
            </div>
          </div>
        </div>

        {coach.birth_place || coach.birth_country ? (
          <p className="mt-4 text-sm text-slate-300">
            <span className="text-slate-500">Sinh tại:</span>{" "}
            {[coach.birth_place, coach.birth_country].filter(Boolean).join(", ")}
          </p>
        ) : null}
      </div>

      {sortedCareer.length > 0 ? (
        <div className="border-t border-white/10 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Sự nghiệp huấn luyện</p>
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {sortedCareer.slice(0, 8).map((entry, index) => (
              <li key={`${entry.team.id}-${entry.start ?? index}`} className="flex items-center gap-3 py-2.5">
                <LogoMark src={entry.team.logo ?? ""} alt="" size={18} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{entry.team.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatYearRange(entry.start, entry.end)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
