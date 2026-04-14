/**
 * GET /api/live/[fixtureId]/stream
 *
 * Server-Sent Events endpoint cho trang chi tiết trận đấu đang diễn ra.
 * Thay thế cách tiếp cận polling 30 giây từ browser — không tạo hàng triệu
 * kết nối hỏi-đáp đồng thời gây quá tải máy chủ.
 *
 * Thiết kế:
 *   - Edge Runtime: không giới hạn thời gian kết nối như Serverless, chi phí thấp hơn
 *   - Poll Redis mỗi 8 giây, chỉ gửi event khi dữ liệu thay đổi
 *   - Chạy tối đa 55 giây rồi đóng → client EventSource tự kết nối lại
 *   - Heartbeat `: ping` mỗi 20 giây để giữ kết nối qua load balancer / nginx
 *   - X-Accel-Buffering: no để nginx không buffer response
 *
 * SSE event format:
 *   event: update
 *   data: { score: LiveScoreState, events: DbEvent[] }
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

import { Redis } from "@upstash/redis";
import type { LiveScoreState, DbEvent } from "@/lib/db-queries";

function cacheKeyScore(id: number) {
  return `live:score:${id}`;
}
function cacheKeyEvents(id: number) {
  return `live:events:${id}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const id = parseInt(fixtureId, 10);

  if (Number.isNaN(id)) {
    return new Response("Invalid fixture ID", { status: 400 });
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const encoder = new TextEncoder();
  const POLL_INTERVAL_MS = 8_000;
  const HEARTBEAT_INTERVAL_MS = 20_000;
  const MAX_DURATION_MS = 55_000;

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      let lastScoreJson = "";
      let heartbeatTimer = 0;

      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      function ping() {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }

      async function poll() {
        try {
          const [score, events] = await Promise.all([
            redis.get<LiveScoreState>(cacheKeyScore(id)).catch(() => null),
            redis.get<DbEvent[]>(cacheKeyEvents(id)).catch(() => null),
          ]);

          const scoreJson = JSON.stringify(score);
          if (scoreJson !== lastScoreJson) {
            lastScoreJson = scoreJson;
            send("update", { score, events: events ?? [] });
          }
        } catch {
          // swallow errors — client sẽ tự kết nối lại
        }
      }

      // Gửi dữ liệu ngay lập tức khi client kết nối
      await poll();

      // Vòng lặp poll
      while (Date.now() - startTime < MAX_DURATION_MS) {
        heartbeatTimer += POLL_INTERVAL_MS;

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        if (heartbeatTimer >= HEARTBEAT_INTERVAL_MS) {
          ping();
          heartbeatTimer = 0;
        }

        await poll();
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
