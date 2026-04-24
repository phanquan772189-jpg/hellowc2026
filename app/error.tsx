"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <div className="site-panel relative overflow-hidden px-6 py-8 text-center sm:px-10 sm:py-12">
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(circle at top, rgba(239,68,68,0.14), transparent 35%), radial-gradient(circle at bottom right, rgba(251,146,60,0.12), transparent 30%)",
            }}
          />
          <div className="relative">
            <span className="section-label">Sự cố</span>
            <h1 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Không tải được nội dung
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              Có lỗi xảy ra khi hiển thị trang này. Bạn có thể thử lại hoặc quay về trang chủ.
            </p>
            {error.digest ? (
              <p className="mt-3 text-xs text-slate-500">Mã lỗi: {error.digest}</p>
            ) : null}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={reset} className="action-primary">
                Thử lại
              </button>
              <Link href="/" className="action-secondary">
                Về trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
