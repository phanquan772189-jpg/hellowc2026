"use client";

/**
 * LiveEventsPanel — Client Component
 *
 * Bọc EventTimeline với khả năng tự cập nhật sự kiện mỗi 30 giây khi trận đang diễn ra.
 * Sau khi trận kết thúc, polling tự dừng.
 *
 * Lý do dùng polling thay vì Supabase Realtime:
 * - Sync job dùng DELETE + INSERT (không dùng UPSERT), Realtime sẽ trigger DELETE events gây flicker.
 * - Polling 30s đơn giản, đáng tin cậy, phù hợp với dữ liệu cập nhật 2 phút/lần.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import EventTimeline from "@/components/EventTimeline";
import type { DbEvent, DbFixtureDetail, LiveScoreState } from "@/lib/db-queries";

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const POLL_INTERVAL_MS = 30_000;

interface LivePayload {
  score: LiveScoreState;
  events: DbEvent[];
}

interface Props {
  fixtureId: number;
  initialEvents: DbEvent[];
  /** Fixture dùng để render EventTimeline — sẽ được cập nhật score khi poll */
  initialFixture: DbFixtureDetail;
}

export default function LiveEventsPanel({ fixtureId, initialEvents, initialFixture }: Props) {
  const [events, setEvents] = useState<DbEvent[]>(initialEvents);
  const [fixture, setFixture] = useState<DbFixtureDetail>(initialFixture);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);

  const fetchLive = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      const res = await fetch(`/api/live/${fixtureId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as LivePayload;

      setEvents(data.events);
      setFixture((prev) => ({
        ...prev,
        goals_home: data.score.goalsHome,
        goals_away: data.score.goalsAway,
        status_short: data.score.statusShort,
        status_elapsed: data.score.statusElapsed,
        score_ht_home: data.score.scoreHtHome,
        score_ht_away: data.score.scoreHtAway,
      }));
      setLastUpdated(new Date());

      // Dừng polling khi trận kết thúc
      if (FINISHED_STATUSES.has(data.score.statusShort)) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch {
      // Silent fail
    }
  }, [fixtureId]);

  useEffect(() => {
    if (!LIVE_STATUSES.has(fixture.status_short)) return;

    timerRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);
    return () => {
      activeRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchLive, fixture.status_short]);

  return (
    <div>
      {LIVE_STATUSES.has(fixture.status_short) && (
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-medium text-red-300">Đang cập nhật tự động</span>
          </div>
          {lastUpdated && (
            <span className="text-[11px] text-slate-500">
              Cập nhật lúc{" "}
              {lastUpdated.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "Asia/Ho_Chi_Minh",
              })}
            </span>
          )}
        </div>
      )}
      <EventTimeline events={events} fixture={fixture} />
    </div>
  );
}
