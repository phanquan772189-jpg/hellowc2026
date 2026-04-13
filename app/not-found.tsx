import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <div className="site-panel relative overflow-hidden px-6 py-8 text-center sm:px-10 sm:py-12">
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(circle at top, rgba(251,146,60,0.16), transparent 35%), radial-gradient(circle at bottom left, rgba(56,189,248,0.12), transparent 30%)",
            }}
          />

          <div className="relative">
            <span className="section-label">404</span>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Không tìm thấy trang
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Liên kết này chưa tồn tại hoặc đã được thay bằng điều hướng mới tập trung vào match center.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/" className="action-primary">
                Về trang chủ
              </Link>
              <Link href="/#match-center" className="action-secondary">
                Xem trận hôm nay
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
