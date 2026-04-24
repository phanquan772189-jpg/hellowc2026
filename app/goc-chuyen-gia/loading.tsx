import { SkeletonBar, SkeletonBlock } from "@/components/skeletons/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6 sm:pt-8">
      <SkeletonBlock>
        <div className="space-y-3">
          <SkeletonBar width={140} height={12} />
          <SkeletonBar width="60%" height={32} />
          <SkeletonBar width="80%" height={14} />
        </div>
      </SkeletonBlock>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="site-panel px-5 py-5">
            <SkeletonBar width={80} height={10} />
            <div className="mt-3">
              <SkeletonBar width="90%" height={16} />
            </div>
            <div className="mt-2">
              <SkeletonBar width="70%" height={12} />
            </div>
            <div className="mt-4 space-y-2">
              <SkeletonBar width="100%" height={10} />
              <SkeletonBar width="95%" height={10} />
              <SkeletonBar width="85%" height={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
