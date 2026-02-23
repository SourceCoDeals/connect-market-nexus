import { cn } from "@/lib/utils";
import { memo } from "react";

/**
 * Reusable skeleton loading components for consistent loading states
 * across the application.
 */

interface SkeletonBaseProps {
  className?: string;
}

/** Base skeleton pulse element */
const SkeletonPulse = memo(function SkeletonPulse({ className }: SkeletonBaseProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
});

/** Text line skeleton with configurable width */
interface TextSkeletonProps extends SkeletonBaseProps {
  lines?: number;
  widths?: string[];
}

const TextSkeleton = memo(function TextSkeleton({
  lines = 3,
  widths,
  className,
}: TextSkeletonProps) {
  const defaultWidths = ["w-full", "w-4/5", "w-3/5", "w-full", "w-2/3"];

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonPulse
          key={i}
          className={cn(
            "h-4",
            (widths?.[i] || defaultWidths[i % defaultWidths.length])
          )}
        />
      ))}
    </div>
  );
});

/** Card skeleton with image, title, and description placeholders */
interface CardSkeletonProps extends SkeletonBaseProps {
  showImage?: boolean;
  imageAspect?: string;
}

const CardSkeleton = memo(function CardSkeleton({
  showImage = true,
  imageAspect = "aspect-video",
  className,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/70 bg-white overflow-hidden",
        className
      )}
    >
      {showImage && (
        <SkeletonPulse className={cn("w-full", imageAspect)} />
      )}
      <div className="p-6 space-y-4">
        {/* Badges row */}
        <div className="flex items-center gap-2">
          <SkeletonPulse className="h-6 w-20 rounded-lg" />
          <SkeletonPulse className="h-6 w-24 rounded-lg" />
          <SkeletonPulse className="h-6 w-16 rounded-lg" />
        </div>

        {/* Title */}
        <SkeletonPulse className="h-6 w-3/4" />

        {/* Financials grid */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50/50 rounded-lg p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonPulse className="h-3 w-16" />
              <SkeletonPulse className="h-5 w-20" />
            </div>
          ))}
        </div>

        {/* Description */}
        <TextSkeleton lines={2} />

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          <SkeletonPulse className="h-11 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-2">
            <SkeletonPulse className="h-9 rounded-lg" />
            <SkeletonPulse className="h-9 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
});

/** Table skeleton with configurable rows and columns */
interface TableSkeletonProps extends SkeletonBaseProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

const TableSkeleton = memo(function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-200">
          {Array.from({ length: columns }).map((_, i) => (
            <SkeletonPulse
              key={`header-${i}`}
              className={cn(
                "h-4",
                i === 0 ? "w-1/4" : i === columns - 1 ? "w-20" : "w-1/6"
              )}
            />
          ))}
        </div>
      )}

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="flex items-center gap-4 px-4 py-3 border-b border-slate-100"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonPulse
              key={`cell-${rowIndex}-${colIndex}`}
              className={cn(
                "h-4",
                colIndex === 0
                  ? "w-1/3"
                  : colIndex === columns - 1
                  ? "w-16"
                  : "w-1/5"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
});

/** List item skeleton */
interface ListSkeletonProps extends SkeletonBaseProps {
  items?: number;
  showAvatar?: boolean;
}

const ListSkeleton = memo(function ListSkeleton({
  items = 5,
  showAvatar = false,
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border border-slate-100"
        >
          {showAvatar && (
            <SkeletonPulse className="h-10 w-10 rounded-full flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <SkeletonPulse className="h-4 w-2/3" />
            <SkeletonPulse className="h-3 w-1/2" />
          </div>
          <SkeletonPulse className="h-8 w-16 rounded-md flex-shrink-0" />
        </div>
      ))}
    </div>
  );
});

/** Dashboard stats skeleton */
const StatsSkeleton = memo(function StatsSkeleton({ className }: SkeletonBaseProps) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
        >
          <SkeletonPulse className="h-3 w-20" />
          <SkeletonPulse className="h-8 w-24" />
          <SkeletonPulse className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
});

/** Page-level skeleton for full page loading states */
const PageSkeleton = memo(function PageSkeleton({ className }: SkeletonBaseProps) {
  return (
    <div className={cn("space-y-6 p-6", className)}>
      {/* Page header */}
      <div className="space-y-2">
        <SkeletonPulse className="h-8 w-64" />
        <SkeletonPulse className="h-4 w-96" />
      </div>

      {/* Stats row */}
      <StatsSkeleton />

      {/* Content area */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <SkeletonPulse className="h-6 w-32" />
          <div className="flex items-center gap-2">
            <SkeletonPulse className="h-9 w-24 rounded-md" />
            <SkeletonPulse className="h-9 w-24 rounded-md" />
          </div>
        </div>
        <TableSkeleton rows={8} columns={5} showHeader={false} />
      </div>
    </div>
  );
});

export {
  SkeletonPulse,
  TextSkeleton,
  CardSkeleton,
  TableSkeleton,
  ListSkeleton,
  StatsSkeleton,
  PageSkeleton,
};
