BEGIN;

-- ============================================================
-- MIGRATION: Livescore Schema Upgrade
-- Date: 2026-04-13
-- ============================================================


-- ============================================================
-- SECTION 1: ALTER TABLE leagues & fixtures
-- ============================================================

-- Thêm cột ưu tiên hiển thị và ghim giải đấu
ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS priority_rank SMALLINT NOT NULL DEFAULT 999,
  ADD COLUMN IF NOT EXISTS is_pinned     BOOLEAN  NOT NULL DEFAULT false;

-- Thêm các cột tỷ số cho fixtures
ALTER TABLE fixtures
  ADD COLUMN IF NOT EXISTS goals_home     SMALLINT,
  ADD COLUMN IF NOT EXISTS goals_away     SMALLINT,
  ADD COLUMN IF NOT EXISTS score_ht_home  SMALLINT,
  ADD COLUMN IF NOT EXISTS score_ht_away  SMALLINT,
  ADD COLUMN IF NOT EXISTS score_ft_home  SMALLINT,
  ADD COLUMN IF NOT EXISTS score_ft_away  SMALLINT,
  ADD COLUMN IF NOT EXISTS score_et_home  SMALLINT,
  ADD COLUMN IF NOT EXISTS score_et_away  SMALLINT,
  ADD COLUMN IF NOT EXISTS score_pen_home SMALLINT,
  ADD COLUMN IF NOT EXISTS score_pen_away SMALLINT;


-- ============================================================
-- SECTION 2: CREATE TABLE fixture_events
-- ============================================================

CREATE TABLE IF NOT EXISTS fixture_events (
  id               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fixture_id       INTEGER     NOT NULL,
  team_id          INTEGER     NOT NULL,
  player_id        INTEGER,
  assist_player_id INTEGER,
  type             TEXT        NOT NULL,
  detail           TEXT,
  time_elapsed     SMALLINT    NOT NULL,
  time_extra       SMALLINT,
  created_at       TIMESTAMPTZ DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_fe_fixture
    FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  CONSTRAINT fk_fe_team
    FOREIGN KEY (team_id)    REFERENCES teams(id)    ON DELETE CASCADE,
  CONSTRAINT fk_fe_player
    FOREIGN KEY (player_id)  REFERENCES players(id)  ON DELETE SET NULL,
  CONSTRAINT fk_fe_assist
    FOREIGN KEY (assist_player_id) REFERENCES players(id) ON DELETE SET NULL,

  -- Chỉ cho phép các loại sự kiện hợp lệ từ API-Football
  CONSTRAINT chk_fe_type
    CHECK (type IN ('Goal', 'Card', 'subst', 'Var'))
);

COMMENT ON TABLE  fixture_events              IS 'Các sự kiện diễn ra trong trận đấu (bàn thắng, thẻ, thay người, VAR)';
COMMENT ON COLUMN fixture_events.type         IS 'Loại sự kiện: Goal | Card | subst | Var';
COMMENT ON COLUMN fixture_events.time_elapsed IS 'Phút diễn ra sự kiện';
COMMENT ON COLUMN fixture_events.time_extra   IS 'Phút bù giờ (nếu có)';


-- ============================================================
-- SECTION 3: CREATE TABLE fixture_lineups & fixture_lineup_players
-- ============================================================

-- Đội hình tổng quát của một đội trong một trận
CREATE TABLE IF NOT EXISTS fixture_lineups (
  fixture_id  INTEGER NOT NULL,
  team_id     INTEGER NOT NULL,
  formation   TEXT,
  coach_name  TEXT,

  PRIMARY KEY (fixture_id, team_id),

  CONSTRAINT fk_fl_fixture
    FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  CONSTRAINT fk_fl_team
    FOREIGN KEY (team_id)    REFERENCES teams(id)    ON DELETE CASCADE
);

COMMENT ON TABLE  fixture_lineups           IS 'Thông tin đội hình (formation, HLV) của mỗi đội trong trận';
COMMENT ON COLUMN fixture_lineups.formation IS 'Sơ đồ chiến thuật, VD: 4-3-3';
COMMENT ON COLUMN fixture_lineups.coach_name IS 'Tên HLV trong trận này';

-- Chi tiết từng cầu thủ trong đội hình
CREATE TABLE IF NOT EXISTS fixture_lineup_players (
  fixture_id    INTEGER  NOT NULL,
  team_id       INTEGER  NOT NULL,
  player_id     INTEGER  NOT NULL,
  is_starting   BOOLEAN  NOT NULL DEFAULT true,
  jersey_number SMALLINT,   -- Số áo thực tế mặc trong trận (khác số áo mặc định của cầu thủ)
  grid_position TEXT,       -- Vị trí trên lưới, VD: '1:1', '2:3'

  PRIMARY KEY (fixture_id, team_id, player_id),

  -- FK trỏ về fixture_lineups (cascade khi lineup bị xóa)
  CONSTRAINT fk_flp_lineup
    FOREIGN KEY (fixture_id, team_id) REFERENCES fixture_lineups(fixture_id, team_id) ON DELETE CASCADE,

  -- FK trỏ về players
  CONSTRAINT fk_flp_player
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

COMMENT ON TABLE  fixture_lineup_players              IS 'Cầu thủ trong đội hình từng trận (đá chính + dự bị)';
COMMENT ON COLUMN fixture_lineup_players.jersey_number IS 'Số áo thực tế mặc trong trận, có thể khác số áo đăng ký thường xuyên';
COMMENT ON COLUMN fixture_lineup_players.is_starting   IS 'true = đá chính, false = dự bị';
COMMENT ON COLUMN fixture_lineup_players.grid_position IS 'Vị trí trên lưới chiến thuật, VD: "1:1"';


-- ============================================================
-- SECTION 4: CREATE TABLE standings
-- ============================================================

CREATE TABLE IF NOT EXISTS standings (
  league_id    INTEGER  NOT NULL,
  season_year  INTEGER  NOT NULL,
  team_id      INTEGER  NOT NULL,
  rank         SMALLINT NOT NULL,
  points       SMALLINT NOT NULL DEFAULT 0,
  goals_diff   SMALLINT NOT NULL DEFAULT 0,
  played       SMALLINT NOT NULL DEFAULT 0,
  win          SMALLINT NOT NULL DEFAULT 0,
  draw         SMALLINT NOT NULL DEFAULT 0,
  lose         SMALLINT NOT NULL DEFAULT 0,
  form         TEXT,        -- Phong độ 5 trận gần nhất, VD: 'WWDLW'
  updated_at   TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (league_id, season_year, team_id),

  CONSTRAINT fk_st_league
    FOREIGN KEY (league_id)   REFERENCES leagues(id)          ON DELETE CASCADE,
  CONSTRAINT fk_st_season
    FOREIGN KEY (season_year) REFERENCES seasons(year)        ON DELETE CASCADE,
  CONSTRAINT fk_st_team
    FOREIGN KEY (team_id)     REFERENCES teams(id)            ON DELETE CASCADE
);

COMMENT ON TABLE  standings            IS 'Bảng xếp hạng theo giải đấu và mùa giải';
COMMENT ON COLUMN standings.form       IS 'Chuỗi phong độ 5 trận gần nhất, VD: WWDLW (W=Win, D=Draw, L=Lose)';
COMMENT ON COLUMN standings.goals_diff IS 'Hiệu số bàn thắng';
COMMENT ON COLUMN standings.updated_at IS 'Thời điểm cập nhật bảng xếp hạng lần cuối';


-- ============================================================
-- SECTION 5: Trigger set_updated_at cho standings
-- (Giả sử hàm set_updated_at() đã tồn tại trong schema.
--  Nếu chưa có, tạo mới bên dưới.)
-- ============================================================

-- Tạo hàm trigger nếu chưa tồn tại
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Gắn trigger vào bảng standings
DROP TRIGGER IF EXISTS trg_standings_set_updated_at ON standings;
CREATE TRIGGER trg_standings_set_updated_at
  BEFORE INSERT OR UPDATE ON standings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SECTION 6: ROW LEVEL SECURITY & PUBLIC READ POLICIES
-- ============================================================

-- fixture_events
ALTER TABLE fixture_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read fixture_events" ON fixture_events;
CREATE POLICY "public read fixture_events"
  ON fixture_events
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- fixture_lineups
ALTER TABLE fixture_lineups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read fixture_lineups" ON fixture_lineups;
CREATE POLICY "public read fixture_lineups"
  ON fixture_lineups
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- fixture_lineup_players
ALTER TABLE fixture_lineup_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read fixture_lineup_players" ON fixture_lineup_players;
CREATE POLICY "public read fixture_lineup_players"
  ON fixture_lineup_players
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- standings
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read standings" ON standings;
CREATE POLICY "public read standings"
  ON standings
  FOR SELECT
  TO anon, authenticated
  USING (true);


-- ============================================================
-- SECTION 7: INDEXES (tối ưu truy vấn phổ biến)
-- ============================================================

-- fixture_events: truy vấn theo trận
CREATE INDEX IF NOT EXISTS idx_fixture_events_fixture_id
  ON fixture_events (fixture_id);

-- fixture_events: truy vấn theo team trong trận
CREATE INDEX IF NOT EXISTS idx_fixture_events_fixture_team
  ON fixture_events (fixture_id, team_id);

-- fixture_lineup_players: truy vấn đội hình đá chính
CREATE INDEX IF NOT EXISTS idx_flp_fixture_starting
  ON fixture_lineup_players (fixture_id, is_starting);

-- standings: truy vấn BXH theo giải + mùa, sắp xếp theo hạng
CREATE INDEX IF NOT EXISTS idx_standings_league_season_rank
  ON standings (league_id, season_year, rank);

-- leagues: sắp xếp theo priority + pin
CREATE INDEX IF NOT EXISTS idx_leagues_priority
  ON leagues (is_pinned DESC, priority_rank ASC);


COMMIT;
