import LogoMark from "@/components/LogoMark";
import type { DbFixtureDetail, DbMatchPrediction } from "@/lib/db-queries";

/**
 * Hiển thị xác suất + so sánh từ /predictions của API-Football.
 * Chú ý: Không hiển thị bất kỳ thông tin cá độ nào — chỉ phân tích.
 */
export default function PredictionPanel({
  prediction,
  fixture,
}: {
  prediction: DbMatchPrediction;
  fixture: DbFixtureDetail;
}) {
  const home = fixture.home_team;
  const away = fixture.away_team;

  const pHome = prediction.percent_home ?? 0;
  const pDraw = prediction.percent_draw ?? 0;
  const pAway = prediction.percent_away ?? 0;
  const totalPercent = pHome + pDraw + pAway;
  const hasPercent = totalPercent > 0;

  const winnerId = prediction.predicted_winner_id;
  const isHomePredicted = winnerId === home.id;
  const isAwayPredicted = winnerId === away.id;

  const comparison = prediction.comparison ?? null;

  return (
    <section className="px-4 py-5 sm:px-6 sm:py-6">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] overflow-hidden">
        <div
          className="border-b border-white/10 px-5 py-4"
          style={{
            background:
              "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(255,255,255,0.03) 65%, rgba(251,146,60,0.10))",
          }}
        >
          <span className="section-label">Phân tích trước trận</span>
          <h3 className="mt-3 text-2xl font-black tracking-tight text-white">Tỷ lệ thắng / hoà</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
            Số liệu xác suất từ pipeline phân tích của API-Football, dựa trên phong độ, đối đầu và kết quả gần đây — không
            phải tỷ lệ cá cược.
          </p>
        </div>

        {/* Probability bar */}
        <div className="px-5 py-5">
        {hasPercent ? (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                style={{ width: `${pHome}%` }}
                className={isHomePredicted ? "bg-emerald-400" : "bg-emerald-400/60"}
                title={`${home.name}: ${pHome}%`}
              />
              <div
                style={{ width: `${pDraw}%` }}
                className="bg-slate-400/60"
                title={`Hoà: ${pDraw}%`}
              />
              <div
                style={{ width: `${pAway}%` }}
                className={isAwayPredicted ? "bg-orange-400" : "bg-orange-400/60"}
                title={`${away.name}: ${pAway}%`}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <PercentBlock
                logo={home.logo_url ?? ""}
                name={home.name}
                percent={pHome}
                tone="home"
                highlighted={isHomePredicted}
              />
              <PercentBlock label="Hoà" percent={pDraw} tone="draw" />
              <PercentBlock
                logo={away.logo_url ?? ""}
                name={away.name}
                percent={pAway}
                tone="away"
                highlighted={isAwayPredicted}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">Chưa có xác suất phân tích cho trận này.</p>
        )}

        {prediction.winner_comment ? (
          <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Ghi chú</span>
            <span className="mt-2 block leading-6">{translateComment(prediction.winner_comment)}</span>
          </p>
        ) : null}
      </div>

        {/* Comparison metrics */}
        {comparison ? (
          <div className="border-t border-white/10 px-5 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">So sánh tổng quan</p>
            <h4 className="mt-2 text-lg font-bold text-white">Hai đội đối đầu trên giấy</h4>

            <div className="mt-4 space-y-3">
              <ComparisonRow label="Phong độ" left={comparison.form?.home} right={comparison.form?.away} home={home.name} away={away.name} />
              <ComparisonRow label="Tấn công" left={comparison.att?.home} right={comparison.att?.away} home={home.name} away={away.name} />
              <ComparisonRow label="Phòng ngự" left={comparison.def?.home} right={comparison.def?.away} home={home.name} away={away.name} />
              <ComparisonRow label="Đối đầu" left={comparison.h2h?.home} right={comparison.h2h?.away} home={home.name} away={away.name} />
              <ComparisonRow label="Hiệu suất bàn thắng" left={comparison.goals?.home} right={comparison.goals?.away} home={home.name} away={away.name} />
              <ComparisonRow label="Tổng hợp" left={comparison.total?.home} right={comparison.total?.away} home={home.name} away={away.name} highlight />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PercentBlock({
  logo,
  name,
  label,
  percent,
  tone,
  highlighted,
}: {
  logo?: string;
  name?: string;
  label?: string;
  percent: number;
  tone: "home" | "draw" | "away";
  highlighted?: boolean;
}) {
  const accent =
    tone === "home"
      ? "text-emerald-300"
      : tone === "away"
        ? "text-orange-300"
        : "text-slate-300";

  return (
    <div
      className={`rounded-2xl border px-3 py-3 text-center ${
        highlighted ? "border-white/20 bg-white/[0.06]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {logo && name ? (
        <div className="flex items-center justify-center gap-1.5">
          <LogoMark src={logo} alt="" size={14} />
          <span className="truncate text-[11px] font-semibold text-slate-300">{name}</span>
        </div>
      ) : (
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</span>
      )}
      <p className={`mt-2 score text-2xl font-black ${accent}`}>{percent}%</p>
    </div>
  );
}

function ComparisonRow({
  label,
  left,
  right,
  home,
  away,
  highlight,
}: {
  label: string;
  left?: string;
  right?: string;
  home: string;
  away: string;
  highlight?: boolean;
}) {
  const leftPercent = parsePercent(left);
  const rightPercent = parsePercent(right);

  if (leftPercent === null && rightPercent === null) return null;

  const total = (leftPercent ?? 0) + (rightPercent ?? 0);
  const leftWidth = total > 0 ? Math.round(((leftPercent ?? 0) / total) * 100) : 50;
  const rightWidth = 100 - leftWidth;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={`font-semibold ${highlight ? "text-white" : "text-slate-300"}`} title={home}>
          {leftPercent ?? "—"}{leftPercent !== null ? "%" : ""}
        </span>
        <span className={`text-[11px] uppercase tracking-[0.24em] ${highlight ? "text-orange-200" : "text-slate-500"}`}>
          {label}
        </span>
        <span className={`font-semibold ${highlight ? "text-white" : "text-slate-300"}`} title={away}>
          {rightPercent ?? "—"}{rightPercent !== null ? "%" : ""}
        </span>
      </div>
      <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          style={{ width: `${leftWidth}%` }}
          className={highlight ? "bg-emerald-400" : "bg-emerald-400/50"}
        />
        <div
          style={{ width: `${rightWidth}%` }}
          className={highlight ? "bg-orange-400" : "bg-orange-400/50"}
        />
      </div>
    </div>
  );
}

function parsePercent(value: string | undefined | null): number | null {
  if (!value) return null;
  const num = Number.parseInt(value.replace("%", "").trim(), 10);
  return Number.isFinite(num) ? num : null;
}

/**
 * API-Football trả "Win or draw" / "Win" / "Lose" tiếng Anh.
 * Dịch sang tiếng Việt cho người dùng VN.
 */
function translateComment(comment: string): string {
  const lower = comment.toLowerCase().trim();
  if (lower === "win or draw") return "Khả năng cao thắng hoặc ít nhất hoà";
  if (lower === "win") return "Khả năng cao thắng";
  if (lower === "lose") return "Khả năng thấp giành kết quả tốt";
  return comment;
}
