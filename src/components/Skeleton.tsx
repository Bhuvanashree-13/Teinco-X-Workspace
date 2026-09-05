export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 dark:bg-gray-700/60 ${className}`} />
}

export function StatCardSkeleton() {
  return (
    <div className="brand-card p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  )
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  )
}

export function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="brand-card overflow-hidden dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-gray-700">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="space-y-1 p-5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 py-2.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="hidden h-3.5 flex-1 sm:block" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="brand-card space-y-4 p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="brand-card space-y-5 p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}