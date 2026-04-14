"use client";

/**
 * LiveEventsPanel — Client Component
 *
 * Bọc EventTimeline với khả năng tự cập nhật sự kiện qua SSE khi trận đang diễn ra.
 * Sau khi trận kết thúc, kết nối SSE tự đóng.
 *
 * Kiến trúc: EventSource → /api/live/[fixtureId]/stream (Edge SSE) → Redis.
 * Server đẩy dữ liệu khi có thay đổi (push), thay vì browser hỏi liên tục (poll 30s).
 * EventSource tự kết nối lại khi server đóng sau 55 giây.
 */

import { useEffect, useRef, useState } from "react";

import EventTimeline from "@/components/EventTimeline";
import type { DbEvent, DbFixtureDetail, LiveScoreState } from "@/lib/match-shared";

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

interface LivePayload {
  score: LiveScoreState;
  events: DbEvent[];
}

interface Props {
  fixtureId: number;
  initialEvents: DbEvent[];
  /** Fixture dùng để render EventTimeline — sẽ được cập nhật score khi nhận SSE update */
  initialFixture: DbFixtureDetail;
}

export default function LiveEventsPanel({ fixtureId, initialEvents, initialFixture }: Props) {
  const [events, setEvents] = useState<DbEvent[]>(initialEvents);
  const [fixture, setFixture] = useState<DbFixtureDetail>(initialFixture);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!LIVE_STATUSES.has(fixture.status_short)) return;

    const es = new EventSource(`/api/live/${fixtureId}/stream`);
    esRef.current = es;

    es.addEventListener("update", (e) => {
      const data = JSON.parse(e.data) as LivePayload;

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

      // Đóng kết nối khi trận kết thúc
      if (FINISHED_STATUSES.has(data.score.statusShort)) {
        es.close();
      }
    });

    es.onerror = (err) => {
      // EventSource tự kết nối lại — không cần xử lý thủ công
      console.warn("[LiveEventsPanel] SSE error, will reconnect:", err);
    };

    return () => {
      es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);

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
