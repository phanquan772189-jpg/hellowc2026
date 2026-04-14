-- ─── fixture_events: sort_order + score_snapshot ─────────────────────────────
--
-- sort_order: thứ tự sự kiện trong trận (theo PDF: "Trường dữ liệu kỹ thuật cực kỳ
--   quan trọng — trình tự timeline không được dựa vào minute mà phải dùng sort_order
--   để xử lý nhiều sự kiện cùng phút")
--
-- score_snapshot: tỉ số tích lũy tại thời điểm bàn thắng (vd "1-0", "2-1")
--   Đây là "Positive snapshot" đề cập trong PDF — giúp API không cần JOIN lại toàn bộ
--   events GOAL để tính tỉ số hiện hành, tối ưu tốc độ truy vấn O(1).

ALTER TABLE public.fixture_events
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

ALTER TABLE public.fixture_events
  ADD COLUMN IF NOT EXISTS score_snapshot TEXT;

-- Composite index hỗ trợ query sắp xếp timeline theo đúng thứ tự
CREATE INDEX IF NOT EXISTS idx_fixture_events_sort
  ON public.fixture_events (fixture_id, time_elapsed, sort_order);
