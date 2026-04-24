import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import LogoMark from "@/components/LogoMark";
import MatchCard from "@/components/MatchCard";
import {
  getTeamDetailFromDB,
  getTeamRecentFixturesFromDB,
  getTeamSquadFromDB,
  getTeamStandingContextsFromDB,
  getTeamUpcomingFixturesFromDB,
  type DbSquadGroup,
  type DbSquadPlayer,
  type DbTeamStandingContext,
} from "@/lib/db-queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const teamId = Number.parseInt(id, 10);
  if (!Number.isFinite(teamId)) return { title: "Đội bóng" };

  const team = await getTeamDetailFromDB(teamId);
  if (!team) return { title: "Đội bóng không tìm thấy" };

  return {
    title: `${team.name} - thông tin đội bóng`,
    description: `Thông tin đội bóng ${team.name}: sân nhà, năm thành lập, giải tham dự, lịch thi đấu và kết quả gần đây.`,
    alternates: { canonical: `/team/${teamId}` },
  };
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function FixturesPanel({
  title,
  empty,
  fixtures,
}: {
  title: string;
  empty: string;
  fixtures: Awaited<ReturnType<typeof getTeamRecentFixturesFromDB>>;
}) {
  return (
    <section className="site-panel overflow-hidden">
      <div className="border-b border-white/10 px-5 py-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-200">{title}</h2>
      </div>
      {fixtures.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="divide-y divide-white/[0.05] px-2 py-2">
          {fixtures.map((fixture) => (
            <MatchCard key={fixture.id} fixture={fixture} />
          ))}
        </div>
      )}
    </section>
  );
}

const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: "Thủ môn",
  Defender: "Hậu vệ",
  Midfielder: "Tiền vệ",
  Attacker: "Tiền đạo",
};

function yearsFromDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - date.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < date.getUTCDate())) age -= 1;
  return age >= 0 && age < 80 ? age : null;
}

function PlayerCard({ entry }: { entry: DbSquadPlayer }) {
  const player = entry.player;
  const age = yearsFromDate(player.birth_date);
  const displayName = player.last_name && player.first_name
    ? `${player.first_name} ${player.last_name}`
    : player.name;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 transition hover:bg-white/[0.05]">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20">
        {player.photo_url ? (
          <Image
            src={player.photo_url}
            alt={displayName}
            fill
            sizes="48px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">?</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {entry.squad_number != null ? (
            <span className="mr-2 inline-block min-w-[1.75rem] rounded bg-white/[0.08] px-1.5 py-0.5 text-center text-[10px] font-bold text-orange-200">
              #{entry.squad_number}
            </span>
          ) : null}
          {displayName}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
          {player.nationality ? (
            <span className="inline-flex items-center gap-1">
              {player.nationality.flag_url ? (
                <Image
                  src={player.nationality.flag_url}
                  alt=""
                  width={12}
                  height={9}
                  className="object-cover"
                  unoptimized
                />
              ) : null}
              <span>{player.nationality.name}</span>
            </span>
          ) : null}
          {age != null ? <span>{age} tuổi</span> : null}
          {player.height_cm ? <span>{player.height_cm} cm</span> : null}
        </p>
      </div>
    </div>
  );
}

function SquadPanel({ groups }: { groups: DbSquadGroup[] }) {
  const total = groups.reduce((sum, group) => sum + group.players.length, 0);

  return (
    <section className="site-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-200">Đội hình</h2>
        {total > 0 ? (
          <span className="text-[11px] text-slate-500">{total} cầu thủ</span>
        ) : null}
      </div>

      {total === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">
          Chưa có dữ liệu đội hình cho đội bóng này.
        </p>
      ) : (
        <div className="space-y-5 px-4 py-4">
          {groups.map((group) => (
            <div key={group.position}>
              <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {POSITION_LABEL[group.position] ?? group.position} · {group.players.length}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.players.map((entry) => (
                  <PlayerCard key={entry.player_id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StandingHighlight({ context }: { context: DbTeamStandingContext }) {
  const { league, entry } = context;

  return (
    <article className="site-panel overflow-hidden">
      <div className="border-b border-white/10 px-5 py-3">
        <Link
          href={`/league/${league.id}?section=standings`}
          className="flex items-center gap-2 transition hover:text-orange-200"
        >
          <LogoMark src={league.logo_url ?? ""} alt="" size={18} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{league.name}</p>
            <p className="text-[11px] text-slate-500">{league.country?.name ?? "Quốc tế"}</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
        <InfoCell label="Hạng" value={`#${entry.rank}`} />
        <InfoCell label="Điểm" value={String(entry.points)} />
        <InfoCell label="Đá" value={String(entry.played)} />
        <InfoCell label="Hiệu số" value={(entry.goals_diff > 0 ? "+" : "") + entry.goals_diff} />
      </div>

      <div className="grid grid-cols-3 gap-3 px-5 pb-5">
        <InfoCell label="Thắng" value={String(entry.win)} />
        <InfoCell label="Hòa" value={String(entry.draw)} />
        <InfoCell label="Thua" value={String(entry.lose)} />
      </div>

      <div className="flex items-center justify-end border-t border-white/10 px-5 py-3 text-xs text-slate-400">
        <Link
          href={`/league/${league.id}?section=standings`}
          className="font-semibold text-orange-200 transition hover:text-white"
        >
          Xem BXH đầy đủ →
        </Link>
      </div>
    </article>
  );
}

export default async function TeamPage({ params }: PageProps) {
  const { id } = await params;
  const teamId = Number.parseInt(id, 10);
  if (!Number.isFinite(teamId)) notFound();

  const team = await getTeamDetailFromDB(teamId);
  if (!team) notFound();

  const [upcoming, recent, standingContexts, squad] = await Promise.all([
    getTeamUpcomingFixturesFromDB(teamId, 6),
    getTeamRecentFixturesFromDB(teamId, 6),
    getTeamStandingContextsFromDB(teamId),
    getTeamSquadFromDB(teamId),
  ]);

  const venueLabel = team.venue
    ? [team.venue.name, team.venue.city].filter(Boolean).join(", ")
    : null;

  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6">
      <section className="site-panel relative mb-6 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(56,189,248,0.2), transparent 40%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          }}
        />

        <div className="relative flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center">
          {team.logo_url ? (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
              <Image
                src={team.logo_url}
                alt={team.name}
                width={56}
                height={56}
                className="object-contain"
                unoptimized
              />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-label">Đội bóng</span>
              {team.code ? <span className="fact-chip">{team.code}</span> : null}
              {team.country ? <span className="fact-chip">{team.country.name}</span> : null}
              {team.founded ? <span className="fact-chip">Thành lập {team.founded}</span> : null}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{team.name}</h1>
            {venueLabel ? (
              <p className="mt-1 text-sm text-slate-400">
                Sân nhà: <span className="text-slate-200">{venueLabel}</span>
                {team.venue?.capacity
                  ? ` · ${team.venue.capacity.toLocaleString("vi-VN")} chỗ`
                  : null}
              </p>
            ) : null}
          </div>
        </div>

        {team.venue?.image_url ? (
          <div className="relative h-48 w-full overflow-hidden border-t border-white/10">
            <Image
              src={team.venue.image_url}
              alt={team.venue.name}
              fill
              sizes="100vw"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 text-sm text-slate-200">
              <span className="font-semibold text-white">{team.venue.name}</span>
              {team.venue.city ? <span className="text-slate-400"> · {team.venue.city}</span> : null}
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_320px]">
        <div className="space-y-5">
          <FixturesPanel
            title="Lịch thi đấu sắp tới"
            empty="Chưa có trận sắp tới cho đội bóng này."
            fixtures={upcoming}
          />
          <FixturesPanel
            title="Kết quả gần đây"
            empty="Chưa có kết quả gần đây."
            fixtures={recent}
          />
          <SquadPanel groups={squad} />
        </div>

        <aside className="space-y-4">
          {standingContexts.length === 0 ? (
            <div className="site-panel px-5 py-6 text-sm text-slate-400">
              Chưa có dữ liệu BXH giải đang theo dõi cho đội này.
            </div>
          ) : (
            standingContexts.map((context) => (
              <StandingHighlight
                key={`${context.league.id}-${context.entry.team_id}`}
                context={context}
              />
            ))
          )}
        </aside>
      </div>
    </div>
  );
}
