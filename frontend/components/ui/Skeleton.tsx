'use client';

import { cn } from '@/lib/utils';

/**
 * Skeleton Component - Prevents CLS by providing fixed-dimension placeholders
 * All skeletons should have explicit width/height to prevent layout shifts
 */

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animate?: boolean;
}

export function Skeleton({
  className,
  width,
  height,
  rounded = 'md',
  animate = true,
}: SkeletonProps) {
  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={cn(
        'bg-gray-200',
        roundedClasses[rounded],
        animate && 'animate-pulse',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton Text - For text content with realistic line heights
 */
interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lineHeight?: number;
}

export function SkeletonText({ lines = 1, className, lineHeight = 20 }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 && lines > 1 ? '75%' : '100%'}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton Card - Fixed dimension card placeholder
 */
interface SkeletonCardProps {
  className?: string;
  height?: number;
}

export function SkeletonCard({ className, height = 96 }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'bg-gray-50 rounded-lg border border-gray-100 p-4 animate-pulse',
        className
      )}
      style={{ height: `${height}px` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton height={16} width="40%" />
          <Skeleton height={28} width="60%" />
          <Skeleton height={12} width="30%" />
        </div>
        <Skeleton width={40} height={40} rounded="lg" />
      </div>
    </div>
  );
}

/**
 * Skeleton Stat Card - Dashboard stat card placeholder
 */
export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border border-gray-100 bg-gray-50 animate-pulse',
        className
      )}
      style={{ height: '104px' }} // Fixed height prevents CLS
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton height={16} width={80} />
          <Skeleton height={32} width={120} />
          <Skeleton height={12} width={60} />
        </div>
        <Skeleton width={40} height={40} rounded="lg" />
      </div>
    </div>
  );
}

/**
 * Skeleton Chart - Chart placeholder with fixed dimensions
 */
interface SkeletonChartProps {
  className?: string;
  height?: number;
}

export function SkeletonChart({ className, height = 300 }: SkeletonChartProps) {
  return (
    <div
      className={cn(
        'bg-gray-50 rounded-lg border border-gray-100 p-4 animate-pulse',
        className
      )}
      style={{ height: `${height}px` }}
    >
      <div className="flex justify-between mb-4">
        <Skeleton height={20} width={100} />
        <div className="flex gap-2">
          <Skeleton height={28} width={60} rounded="lg" />
          <Skeleton height={28} width={60} rounded="lg" />
        </div>
      </div>
      <div className="flex items-end justify-between h-[calc(100%-60px)] gap-2 px-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            width={20}
            height={`${30 + Math.random() * 60}%`}
            rounded="sm"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton Table Row - Table row placeholder
 */
export function SkeletonTableRow({ columns = 5, className }: { columns?: number; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse',
        className
      )}
      style={{ height: '72px' }} // Fixed height prevents CLS
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          className="flex-1"
          width={i === 0 ? '120px' : i === columns - 1 ? '80px' : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton Avatar - Circular avatar placeholder
 */
interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SkeletonAvatar({ size = 'md', className }: SkeletonAvatarProps) {
  const sizes = {
    sm: 32,
    md: 40,
    lg: 56,
  };

  return (
    <Skeleton
      width={sizes[size]}
      height={sizes[size]}
      rounded="full"
      className={className}
    />
  );
}

/**
 * Skeleton Button - Button placeholder
 */
interface SkeletonButtonProps {
  size?: 'sm' | 'md' | 'lg';
  width?: number | string;
  className?: string;
}

export function SkeletonButton({ size = 'md', width = 100, className }: SkeletonButtonProps) {
  const heights = {
    sm: 32,
    md: 40,
    lg: 48,
  };

  return (
    <Skeleton
      width={width}
      height={heights[size]}
      rounded="lg"
      className={className}
    />
  );
}

export default Skeleton;
