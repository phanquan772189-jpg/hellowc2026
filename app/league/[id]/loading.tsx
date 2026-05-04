import { FixturesSkeleton, SkeletonBar, SkeletonBlock, StandingsSkeleton } from "@/components/skeletons/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6 sm:pt-8">
      <SkeletonBlock>
        <div className="flex items-center gap-4">
          <SkeletonBar width={64} height={64} rounded="rounded-lg" />
          <div className="flex-1 space-y-3">
            <SkeletonBar width="40%" height={24} />
            <SkeletonBar width="30%" height={12} />
          </div>
        </div>
      </SkeletonBlock>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)]">
        <FixturesSkeleton count={6} />
        <StandingsSkeleton />
      </div>
    </div>
  );
}
