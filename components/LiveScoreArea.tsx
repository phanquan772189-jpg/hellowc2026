"use client";

/**
 * LiveScoreArea — Client Component
 *
 * Hiển thị tỉ số + trạng thái trận đấu đang diễn ra với tự động cập nhật qua SSE.
 * Thay thế khối tỉ số tĩnh trong ScoreHeader cho các trận LIVE.
 *
 * Kiến trúc: EventSource → /api/live/[fixtureId]/stream (Edge SSE) → Redis → re-render.
 * Server đẩy dữ liệu khi có thay đổi (push), thay vì browser hỏi liên tục (poll 30s).
 * EventSource tự kết nối lại khi server đóng sau 55 giây.
 */

import { useEffect, useRef, useState } from "react";

import type { LiveScoreState } from "@/lib/match-shared";

export type { LiveScoreState };

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

interface Props {
  fixtureId: number;
  initial: LiveScoreState;
  kickoffAt: string;
}

function formatKickoff(date: string) {
  return new Date(date).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function liveLabel(statusShort: string, elapsed: number | null): string {
  if (statusShort === "HT") return "Nghỉ giữa hiệp";
  if (statusShort === "ET") return `Hiệp phụ ${elapsed ?? 0}'`;
  if (statusShort === "P") return "Luân lưu 11m";
  if (statusShort === "BT") return "Nghỉ trước hiệp phụ";
  if (elapsed) return `${elapsed}'`;
  return "LIVE";
}

export default function LiveScoreArea({ fixtureId, initial, kickoffAt }: Props) {
  const [score, setScore] = useState<LiveScoreState>(initial);
  const [pulse, setPulse] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // SSE — chỉ kết nối khi trận đang diễn ra
  useEffect(() => {
    if (!LIVE_STATUSES.has(score.statusShort)) return;

    const es = new EventSource(`/api/live/${fixtureId}/stream`);
    esRef.current = es;

    es.addEventListener("update", (e) => {
      const payload = JSON.parse(e.data) as { score: LiveScoreState | null };
      const newScore = payload.score;
      if (!newScore) return;

      setScore((prev) => {
        const scoredGoal =
          prev.goalsHome !== newScore.goalsHome ||
          prev.goalsAway !== newScore.goalsAway;
        if (scoredGoal) setPulse(true);
        return newScore;
      });

      // Đóng kết nối khi trận kết thúc
      if (FINISHED_STATUSES.has(newScore.statusShort)) {
        es.close();
      }
    });

    es.onerror = (err) => {
      // EventSource tự kết nối lại — không cần xử lý thủ công
      console.warn("[LiveScoreArea] SSE error, will reconnect:", err);
    };

    return () => {
      es.close();
    };
  }, [fixtureId, score.statusShort]);

  // Polling fallback — khi trận chưa diễn ra hoặc đã kết thúc,
  // poll mỗi 30s để phát hiện chuyển trạng thái (NS→1H, LIVE→FT, v.v.)
  useEffect(() => {
    if (LIVE_STATUSES.has(score.statusShort)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/${fixtureId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { score: LiveScoreState };
        if (data.score) {
          setScore((prev) =>
            prev.statusShort === data.score.statusShort &&
            prev.goalsHome === data.score.goalsHome &&
            prev.goalsAway === data.score.goalsAway
              ? prev
              : data.score
          );
        }
      } catch {
        // bỏ qua lỗi mạng tạm thời
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [fixtureId, score.statusShort]);

  // Tắt hiệu ứng pulse sau 1.5s
  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(false), 1500);
    return () => clearTimeout(t);
  }, [pulse]);

  const isLive = LIVE_STATUSES.has(score.statusShort);

  return (
    <div
      className={`mx-auto w-full max-w-[280px] rounded-[30px] border px-5 py-6 text-center shadow-card transition-all duration-500
        ${pulse ? "border-emerald-400/30 bg-emerald-500/10 ring-2 ring-emerald-400/20" : "border-white/10 bg-black/15"}`}
    >
      {score.goalsHome !== null ? (
        <>
          <div className="flex items-center justify-center gap-3">
            <span
              className={`score text-5xl font-black tabular-nums transition-colors duration-300 ${pulse ? "text-emerald-300" : "text-white"}`}
            >
              {score.goalsHome}
            </span>
            <span className="text-slate-500">-</span>
            <span
              className={`score text-5xl font-black tabular-nums transition-colors duration-300 ${pulse ? "text-emerald-300" : "text-white"}`}
            >
              {score.goalsAway}
            </span>
          </div>

          {score.scoreHtHome !== null && (
            <p className="mt-3 text-sm text-slate-400">
              HT {score.scoreHtHome} – {score.scoreHtAway}
            </p>
          )}

          {isLive && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-bold tabular-nums text-red-300">
                {liveLabel(score.statusShort, score.statusElapsed)}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="score text-4xl font-black text-white">{formatKickoff(kickoffAt)}</p>
          <p className="mt-3 text-sm text-slate-400">{formatDate(kickoffAt)}</p>
        </>
      )}
    </div>
  );
}
