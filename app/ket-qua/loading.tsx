import { FixturesSkeleton, SkeletonBar, SkeletonBlock } from "@/components/skeletons/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6 sm:pt-8">
      <SkeletonBlock>
        <div className="space-y-3">
          <SkeletonBar width={120} height={12} />
          <SkeletonBar width="50%" height={28} />
          <SkeletonBar width="70%" height={12} />
        </div>
      </SkeletonBlock>
      <div className="mt-6 space-y-6">
        <FixturesSkeleton count={6} />
        <FixturesSkeleton count={4} />
      </div>
    </div>
  );
}
