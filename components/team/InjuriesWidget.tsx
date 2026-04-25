import Image from "next/image";

import type { DbTeamInjury } from "@/lib/db-queries";

function translateType(type: string) {
  const lower = type.toLowerCase();
  if (lower === "missing fixture") return "Vắng mặt";
  if (lower === "questionable") return "Chưa chắc chắn";
  return type;
}

function translateReason(reason: string | null): string {
  if (!reason) return "—";
  // Một số reason phổ biến có thể dịch nhanh; còn lại giữ nguyên tiếng Anh.
  const map: Record<string, string> = {
    "Knee injury": "Chấn thương đầu gối",
    "Hamstring injury": "Chấn thương gân kheo",
    "Calf injury": "Chấn thương bắp chân",
    "Ankle injury": "Chấn thương cổ chân",
    "Muscular injury": "Chấn thương cơ",
    "Thigh injury": "Chấn thương đùi",
    "Groin injury": "Chấn thương háng",
    "Back injury": "Chấn thương lưng",
    "Suspended": "Treo giò",
    "Coach Decision": "Quyết định của HLV",
    "Illness": "Ốm",
    "Broken Foot": "Gãy bàn chân",
    "Broken Leg": "Gãy chân",
  };
  return map[reason] ?? reason;
}

export default function InjuriesWidget({ injuries }: { injuries: DbTeamInjury[] }) {
  return (
    <section className="site-panel overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(248,113,113,0.16), rgba(255,255,255,0.03) 65%, rgba(15,23,42,0.12))",
        }}
      >
        <span className="section-label">Tình trạng nhân sự</span>
        <div className="mt-3 flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-white">Chấn thương / treo giò</h2>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200">
            {injuries.length} cầu thủ
          </span>
        </div>
      </div>

      {injuries.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">
          Hiện chưa có cầu thủ nào nằm trong danh sách chấn thương / treo giò.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {injuries.map((entry) => (
            <li key={`${entry.player_id}-${entry.fixture_id ?? "no-fixture"}`} className="flex items-center gap-3 px-4 py-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20">
                {entry.player_photo_url ? (
                  <Image
                    src={entry.player_photo_url}
                    alt={entry.player_name}
                    fill
                    className="object-cover"
                    sizes="40px"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs text-slate-500">?</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{entry.player_name}</p>
                <p className="mt-0.5 text-xs text-slate-400">{translateReason(entry.reason)}</p>
              </div>

              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  entry.type.toLowerCase() === "missing fixture"
                    ? "border-red-400/30 bg-red-500/10 text-red-200"
                    : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                }`}
              >
                {translateType(entry.type)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
