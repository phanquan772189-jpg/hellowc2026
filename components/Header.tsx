"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { label: "Kết Quả", href: "/ket-qua" },
  { label: "Lịch Thi Đấu", href: "/lich-thi-dau" },
  { label: "BXH", href: "/bang-xep-hang" },
  { label: "Góc Chuyên Gia", href: "/goc-chuyen-gia" },
] as const;

export default function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#07131f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between gap-6 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="KetquaWC.vn">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-sm shadow-lg shadow-orange-500/30">
            ⚽
          </span>
          <span className="text-sm font-bold tracking-tight text-white">
            KetquaWC<span className="text-orange-400/60">.vn</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Menu chính">
          {NAV.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive(href) ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300 sm:flex">
            <span className="live-dot" />
            LIVE
          </span>
          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white md:hidden"
            aria-label={isOpen ? "Đóng menu" : "Mở menu"}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>

      {isOpen ? (
        <div id="mobile-nav" className="border-t border-white/[0.07] px-4 pb-4 pt-3 md:hidden">
          <nav className="mx-auto flex max-w-screen-xl flex-col gap-2" aria-label="Menu mobile">
            {NAV.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  isActive(href)
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
