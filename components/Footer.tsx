import Link from "next/link";

const SITE_LINKS = [
  { label: "Trang chủ", href: "/" },
  { label: "Kết quả", href: "/ket-qua" },
  { label: "Lịch thi đấu", href: "/lich-thi-dau" },
  { label: "Bảng xếp hạng", href: "/bang-xep-hang" },
  { label: "Góc chuyên gia", href: "/goc-chuyen-gia" },
] as const;

const LEGAL_LINKS = [
  { label: "Chính sách bảo mật", href: "/chinh-sach-bao-mat" },
  { label: "Điều khoản sử dụng", href: "/dieu-khoan-su-dung" },
  { label: "Liên hệ", href: "/lien-he" },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 px-4 pb-8 pt-10">
      <div className="mx-auto max-w-screen-xl">
        <div className="site-panel overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div className="space-y-5">
              <div>
                <span className="section-label">KetquaWC.vn</span>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Tỷ số bóng đá trực tiếp — nhanh, đầy đủ và không phiền nhiễu.
                </h2>
              </div>

              <p className="max-w-2xl text-sm leading-7 text-slate-300">
                Theo dõi tỷ số trực tiếp, kết quả, lịch thi đấu, bảng xếp hạng và nhận định chuyên sâu của tất cả các giải lớn — World Cup 2026, Premier League, La Liga, Bundesliga và Serie A.
              </p>

              <div className="rounded-[24px] border border-white/10 bg-black/10 p-4 text-sm leading-7 text-slate-300">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-200/80">Tuyên bố miễn trừ</p>
                <p className="mt-3">
                  KetquaWC.vn là trang thông tin cá nhân về bóng đá, không phải tổ chức báo chí hay cơ quan truyền thông. Trang không tổ chức, không tham gia và không khuyến khích bất kỳ hình thức cá cược nào. Thông tin chỉ mang tính tham khảo.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="site-panel-soft p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Điều hướng</p>
                <nav className="mt-4 flex flex-col gap-3">
                  {SITE_LINKS.map(({ label, href }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                    >
                      {label}
                      <span className="text-slate-500">→</span>
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="site-panel-soft p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Pháp lý</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <p>Dữ liệu: API-Football.</p>
                  <div className="flex flex-col gap-2 pt-2">
                    {LEGAL_LINKS.map(({ label, href }) => (
                      <Link key={href} href={href} className="text-sm font-medium text-slate-200 transition hover:text-white">
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-slate-500">
            <p>© {year} KetquaWC.vn. Thông tin chỉ mang tính tham khảo.</p>
            <p>Dữ liệu: API-Football</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
