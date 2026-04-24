import type { CSSProperties, ReactNode } from "react";

type SkeletonBarProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: string;
  style?: CSSProperties;
};

export function SkeletonBar({
  className = "",
  width,
  height = 12,
  rounded = "rounded-full",
  style,
}: SkeletonBarProps) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse-soft bg-white/[0.08] ${rounded} ${className}`}
      style={{ width, height, ...style }}
    />
  );
}

export function SkeletonLine({ width = "100%" }: { width?: string | number }) {
  return <SkeletonBar width={width} height={10} />;
}

export function SkeletonCircle({ size = 32 }: { size?: number }) {
  return <SkeletonBar width={size} height={size} rounded="rounded-full" />;
}

export function SkeletonBlock({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`site-panel relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8 ${className}`}
      aria-busy
      aria-live="polite"
    >
      {children}
    </div>
  );
}

export function SkeletonMatchRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
      <SkeletonBar width={40} height={10} />
      <div className="flex flex-1 items-center gap-3">
        <SkeletonCircle size={28} />
        <SkeletonLine width="40%" />
      </div>
      <SkeletonBar width={44} height={18} rounded="rounded-lg" />
      <div className="flex flex-1 items-center justify-end gap-3">
        <SkeletonLine width="40%" />
        <SkeletonCircle size={28} />
      </div>
    </div>
  );
}

export function SkeletonStandingsRow() {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-b-0">
      <SkeletonBar width={18} height={10} />
      <SkeletonCircle size={24} />
      <SkeletonLine width="45%" />
      <div className="ml-auto flex items-center gap-4">
        <SkeletonBar width={22} height={10} />
        <SkeletonBar width={22} height={10} />
        <SkeletonBar width={26} height={10} />
      </div>
    </div>
  );
}

export function FixturesSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonBlock>
      <div className="space-y-3">
        <SkeletonBar width={140} height={14} />
        <div className="mt-4 space-y-2">
          {Array.from({ length: count }).map((_, i) => (
            <SkeletonMatchRow key={i} />
          ))}
        </div>
      </div>
    </SkeletonBlock>
  );
}

export function StandingsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <SkeletonBlock>
      <SkeletonBar width={180} height={14} />
      <div className="mt-4 divide-y divide-white/5 rounded-lg border border-white/5 bg-white/[0.02]">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonStandingsRow key={i} />
        ))}
      </div>
    </SkeletonBlock>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6 sm:pt-8">
      <SkeletonBlock>
        <div className="space-y-4">
          <SkeletonBar width={160} height={14} />
          <SkeletonBar width="60%" height={32} />
          <SkeletonBar width="80%" height={14} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                <SkeletonBar width="40%" height={10} />
                <div className="mt-3">
                  <SkeletonBar width="50%" height={24} />
                </div>
                <div className="mt-2">
                  <SkeletonBar width="70%" height={10} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SkeletonBlock>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <FixturesSkeleton />
        <StandingsSkeleton />
      </div>
    </div>
  );
}

export function MatchDetailSkeleton() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6 sm:pt-8">
      <SkeletonBlock>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <SkeletonBar width={120} height={12} />
            <SkeletonBar width={80} height={12} />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex flex-col items-center gap-3">
              <SkeletonCircle size={64} />
              <SkeletonBar width="60%" height={14} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <SkeletonBar width={110} height={44} rounded="rounded-lg" />
              <SkeletonBar width={60} height={10} />
            </div>
            <div className="flex flex-col items-center gap-3">
              <SkeletonCircle size={64} />
              <SkeletonBar width="60%" height={14} />
            </div>
          </div>
        </div>
      </SkeletonBlock>
      <div className="mt-6 flex gap-2 overflow-x-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBar key={i} width={80} height={34} rounded="rounded-lg" />
        ))}
      </div>
      <div className="mt-6">
        <FixturesSkeleton count={5} />
      </div>
    </div>
  );
}
