import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import LogoMark from "@/components/LogoMark";
import MatchCard from "@/components/MatchCard";
import WorldCupGroupsBoard from "@/components/league/WorldCupGroupsBoard";
import {
  getLeagueAllRounds,
  getLeagueFixturesByRoundPrefix,
  getStandingsFromDB,
  getTopPlayersFromDB,
  groupStandingsByLabel,
  type DbFixture,
  type DbStanding,
  type DbStandingsGroup,
  type DbTopPlayer,
} from "@/lib/db-queries";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;
const WC_OPENING_KICKOFF = "2026-06-11T20:00:00-04:00"; // Mexico City local
const WC_FINAL_DATE = "2026-07-19";
const HOSTS = [
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "US", name: "Hoa Kỳ", flag: "🇺🇸" },
];

// Tận dụng ISR — page được render lại tối đa 5 phút/lần ở Edge.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "World Cup 2026 - Lịch, BXH 12 bảng đấu và knockout",
  description:
    "Theo dõi FIFA World Cup 2026: 12 bảng đấu của 48 đội, vòng loại trực tiếp từ vòng 1/16 tới chung kết, vua phá lưới và toàn bộ lịch thi đấu chạy từ 11/6 đến 19/7.",
  alternates: { canonical: "/world-cup-2026" },
  openGraph: {
    title: "FIFA World Cup 2026 — Tổng quan giải đấu",
    description:
      "12 bảng đấu, 104 trận, 48 đội tuyển, 16 sân vận động trải khắp Canada, Mexico và Hoa Kỳ.",
  },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function shortGroupLabel(label: string) {
  const match = /(Group\s+[A-Z0-9]+)/i.exec(label);
  return match ? match[1] : label;
}

function getCountdown(targetIso: string) {
  const now = Date.now();
  const target = new Date(targetIso).getTime();
  const diff = target - now;
  if (diff <= 0) return null;

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  return { days, hours };
}

const KNOCKOUT_STAGES: { id: string; prefix: string; label: string; window: string }[] = [
  { id: "r32", prefix: "Round of 32", label: "Vòng 1/16 (Round of 32)", window: "28/6 – 3/7" },
  { id: "r16", prefix: "Round of 16", label: "Vòng 1/8 (Round of 16)", window: "4/7 – 7/7" },
  { id: "qf", prefix: "Quarter-finals", label: "Tứ kết", window: "9/7 – 11/7" },
  { id: "sf", prefix: "Semi-finals", label: "Bán kết", window: "14/7 – 15/7" },
  { id: "tp", prefix: "3rd Place Final", label: "Tranh hạng ba", window: "18/7" },
  { id: "final", prefix: "Final", label: "Chung kết", window: "19/7" },
];

const SECTION_NAV: { id: string; label: string }[] = [
  { id: "groups", label: "Bảng đấu" },
  { id: "knockout", label: "Vòng loại trực tiếp" },
  { id: "stats", label: "Thống kê cá nhân" },
  { id: "schedule", label: "Lịch tổng" },
];

// ─────────────────────────────────────────────
// Data layer
// ─────────────────────────────────────────────

async function loadGroupFixtures(): Promise<DbFixture[]> {
  return getLeagueFixturesByRoundPrefix(WC_LEAGUE_ID, WC_SEASON, "Group Stage");
}

async function loadKnockoutFixtures() {
  const results = await Promise.all(
    KNOCKOUT_STAGES.map(async (stage) => ({
      stage,
      fixtures: await getLeagueFixturesByRoundPrefix(WC_LEAGUE_ID, WC_SEASON, stage.prefix),
    }))
  );
  return results;
}

async function loadTopPlayers() {
  const [scorers, assists, cards] = await Promise.all([
    getTopPlayersFromDB(WC_LEAGUE_ID, WC_SEASON, "scorer"),
    getTopPlayersFromDB(WC_LEAGUE_ID, WC_SEASON, "assist"),
    getTopPlayersFromDB(WC_LEAGUE_ID, WC_SEASON, "yellowcard"),
  ]);
  return { scorers, assists, cards };
}

async function loadAllRounds(): Promise<string[]> {
  return getLeagueAllRounds(WC_LEAGUE_ID, WC_SEASON);
}

async function loadStandings(): Promise<DbStanding[]> {
  return getStandingsFromDB(WC_LEAGUE_ID, WC_SEASON);
}

async function getLeagueLogo(): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from("leagues")
    .select("logo_url")
    .eq("id", WC_LEAGUE_ID)
    .maybeSingle();

  return (data?.logo_url as string | null) ?? null;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function HeroStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 score text-3xl font-black text-white">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-300">{hint}</p> : null}
    </div>
  );
}

function HostFlag({ flag, name }: { flag: string; name: string }) {
  return (
    <span className="fact-chip">
      <span className="text-base leading-none">{flag}</span>
      <span>{name}</span>
    </span>
  );
}

function GroupCardFromStandings({ group }: { group: DbStandingsGroup }) {
  const label = group.label ? shortGroupLabel(group.label) : "Bảng";

  return (
    <article className="site-panel overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,146,60,0.14), rgba(56,189,248,0.08) 60%, rgba(255,255,255,0.02))",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="section-label">Bảng {label.replace(/^Group\s+/i, "")}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200">
            {group.entries.length} đội
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-500">
              <th className="w-8 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">#</th>
              <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">Đội</th>
              <th className="w-9 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">Đ</th>
              <th className="w-9 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">T</th>
              <th className="w-9 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">H</th>
              <th className="w-9 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">B</th>
              <th className="w-12 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">HS</th>
              <th className="w-12 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200">PT</th>
            </tr>
          </thead>
          <tbody>
            {group.entries.map((entry) => (
              <tr key={entry.team_id} className="border-b border-white/[0.05] transition hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-sm text-slate-400">{entry.rank}</td>
                <td className="py-3 pr-2">
                  <Link href={`/team/${entry.team_id}`} className="flex items-center gap-2 transition hover:text-orange-200">
                    <LogoMark src={entry.team.logo_url ?? ""} alt="" size={18} />
                    <span className="truncate font-medium text-white">{entry.team.name}</span>
                  </Link>
                </td>
                <td className="py-3 text-center text-slate-300">{entry.played}</td>
                <td className="py-3 text-center text-slate-300">{entry.win}</td>
                <td className="py-3 text-center text-slate-300">{entry.draw}</td>
                <td className="py-3 text-center text-slate-300">{entry.lose}</td>
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
      </div>
    </article>
  );
}

function TopPlayersColumn({
  title,
  hint,
  valueLabel,
  players,
}: {
  title: string;
  hint: string;
  valueLabel: string;
  players: DbTopPlayer[];
}) {
  return (
    <article className="site-panel overflow-hidden">
      <div
        className="border-b border-white/10 px-4 py-3"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,146,60,0.14), rgba(56,189,248,0.08) 60%, rgba(255,255,255,0.02))",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{hint}</p>
        <h3 className="mt-1.5 text-lg font-bold text-white">{title}</h3>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {players.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa có dữ liệu — sẽ cập nhật khi giải khởi tranh.</p>
        ) : (
          players.slice(0, 8).map((p) => (
            <div key={p.player.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-500">{p.rank}</span>
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20">
                {p.player.photo_url ? (
                  <Image src={p.player.photo_url} alt={p.player.name} fill className="object-cover" sizes="36px" unoptimized />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs text-slate-500">?</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{p.player.name}</p>
                {p.team ? (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <LogoMark src={p.team.logo_url ?? ""} alt="" size={12} />
                    <span className="truncate text-[11px] text-slate-400">{p.team.name}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-center">
                <span className="text-lg font-black text-white">{p.stat_value}</span>
                <span className="text-[9px] text-slate-500">{valueLabel}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function KnockoutStageCard({
  label,
  window,
  fixtures,
}: {
  label: string;
  window: string;
  fixtures: DbFixture[];
}) {
  return (
    <article className="site-panel overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(255,255,255,0.03) 65%, rgba(251,146,60,0.08))",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="section-label">{label}</span>
            <p className="mt-3 text-sm text-slate-300">Khung giờ: {window}</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200">
            {fixtures.length} trận
          </span>
        </div>
      </div>
      {fixtures.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-400">
          Chưa có cặp đấu — sẽ cập nhật sau khi vòng trước kết thúc.
        </p>
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {fixtures.map((fixture) => (
            <MatchCard key={fixture.id} fixture={fixture} showDate />
          ))}
        </div>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default async function WorldCup2026Page() {
  const [
    standings,
    groupFixtures,
    knockout,
    topPlayers,
    rounds,
    leagueLogo,
  ] = await Promise.all([
    loadStandings(),
    loadGroupFixtures(),
    loadKnockoutFixtures(),
    loadTopPlayers(),
    loadAllRounds(),
    getLeagueLogo(),
  ]);

  const groups = groupStandingsByLabel(standings);
  const hasStandings = standings.length > 0 && groups.length > 0;
  const countdown = getCountdown(WC_OPENING_KICKOFF);

  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6">
      {/* HERO */}
      <section className="site-panel relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(56,189,248,0.22), transparent 30%), radial-gradient(circle at right center, rgba(251,146,60,0.18), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            {leagueLogo ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                <LogoMark src={leagueLogo} alt="World Cup" size={28} />
              </div>
            ) : null}
            <span className="section-label">FIFA World Cup 2026</span>
          </div>

          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
            World Cup 2026 — 48 đội, 12 bảng, một mùa hè
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Lần đầu tiên trong lịch sử, World Cup được đồng tổ chức bởi ba quốc gia. Khán giả sẽ chứng kiến 104 trận
            đấu trải khắp 16 sân vận động ở bốn múi giờ khác nhau, từ 11/6 đến 19/7.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {HOSTS.map((host) => (
              <HostFlag key={host.code} flag={host.flag} name={host.name} />
            ))}
            <span className="fact-chip">11/6 – 19/7/2026</span>
            <span className="fact-chip">48 đội · 16 sân</span>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <HeroStat
              label="Đếm ngược khai mạc"
              value={countdown ? `${countdown.days} ngày` : "Đã khai mạc"}
              hint={countdown ? `Còn ${countdown.hours} giờ tới trận khai mạc 11/6` : `Theo dõi diễn biến tới chung kết ${WC_FINAL_DATE.replace(/-/g, "/")}`}
            />
            <HeroStat label="Bảng đấu" value="12" hint="Mỗi bảng 4 đội. Top 2 + 8 đội hạng 3 tốt nhất đi tiếp." />
            <HeroStat
              label="Tổng số trận"
              value="104"
              hint="72 trận vòng bảng + 32 trận knockout."
            />
          </div>
        </div>
      </section>

      {/* SECTION NAV */}
      <div className="site-panel mt-6 px-5 py-4">
        <span className="section-label">Đi nhanh tới mục</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {SECTION_NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.10]"
            >
              {item.label}
            </a>
          ))}
          <Link
            href={`/league/${WC_LEAGUE_ID}`}
            className="rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-100 transition hover:bg-orange-500/15"
          >
            Trang chi tiết giải →
          </Link>
        </div>
      </div>

      {/* GROUPS */}
      <section id="groups" className="mt-8 scroll-mt-24">
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="section-label">Vòng bảng</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">12 bảng đấu</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
              Top 2 mỗi bảng và 8 đội xếp hạng 3 tốt nhất sẽ đi tiếp vào vòng 1/16.
            </p>
          </div>
        </div>

        {hasStandings ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {groups.map((group) => (
              <GroupCardFromStandings key={group.label ?? "default"} group={group} />
            ))}
          </div>
        ) : groupFixtures.length > 0 ? (
          <div className="mt-6">
            <WorldCupGroupsBoard fixtures={groupFixtures} />
          </div>
        ) : (
          <div className="site-panel mt-6 px-5 py-12 text-center">
            <p className="text-sm text-slate-400">
              Lịch vòng bảng sẽ được cập nhật ngay khi FIFA công bố. Mời bạn quay lại sau.
            </p>
          </div>
        )}
      </section>

      {/* KNOCKOUT */}
      <section id="knockout" className="mt-12 scroll-mt-24">
        <span className="section-label">Vòng loại trực tiếp</span>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Đường tới chiếc cúp</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
          32 đội bước vào nhánh đấu loại trực tiếp. Mỗi cặp đấu là một trận duy nhất — thắng đi tiếp, thua về nước.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {knockout.map(({ stage, fixtures }) => (
            <KnockoutStageCard key={stage.id} label={stage.label} window={stage.window} fixtures={fixtures} />
          ))}
        </div>
      </section>

      {/* TOP PLAYERS */}
      <section id="stats" className="mt-12 scroll-mt-24">
        <span className="section-label">Thống kê cá nhân</span>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Top cầu thủ</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
          Vua phá lưới, vua kiến tạo và bảng kỷ luật — cập nhật theo mỗi trận đấu.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <TopPlayersColumn title="Vua phá lưới" hint="Bàn thắng" valueLabel="Bàn" players={topPlayers.scorers} />
          <TopPlayersColumn title="Vua kiến tạo" hint="Đường chuyền quyết định" valueLabel="Kiến tạo" players={topPlayers.assists} />
          <TopPlayersColumn title="Thẻ phạt" hint="Kỷ luật" valueLabel="Thẻ vàng" players={topPlayers.cards} />
        </div>
      </section>

      {/* SCHEDULE BY ROUND */}
      <section id="schedule" className="mt-12 scroll-mt-24">
        <span className="section-label">Lịch tổng</span>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Tất cả các vòng</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
          Bấm vào một vòng bất kỳ để xem trực tiếp các trận của vòng đó ở trang chi tiết giải.
        </p>

        {rounds.length === 0 ? (
          <p className="mt-6 site-panel px-5 py-8 text-center text-sm text-slate-400">
            Lịch sẽ xuất hiện khi dữ liệu sync về DB.
          </p>
        ) : (
          <div className="site-panel mt-6 px-5 py-5">
            <div className="flex flex-wrap gap-2">
              {rounds.map((round) => (
                <Link
                  key={round}
                  href={`/league/${WC_LEAGUE_ID}?section=fixtures&round=${encodeURIComponent(round)}`}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                >
                  {round}
                </Link>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>{rounds.length} vòng đấu</span>
              <Link href={`/league/${WC_LEAGUE_ID}?section=fixtures`} className="font-semibold text-orange-200 transition hover:text-white">
                Xem toàn bộ lịch ở trang giải →
              </Link>
            </div>
          </div>
        )}
      </section>

      <p className="mt-12 text-center text-xs text-slate-500">
        Dữ liệu cập nhật từ API-Football. Khung giờ và sân thi đấu có thể thay đổi theo thông báo của FIFA.
      </p>
    </div>
  );
}
