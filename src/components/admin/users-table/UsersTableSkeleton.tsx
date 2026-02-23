// Loading skeleton component
export const UsersTableSkeleton = () => (
  <div className="space-y-3">
    <div className="h-10 bg-muted/50 rounded-md animate-pulse"></div>
    {Array(5)
      .fill(0)
      .map((_, i) => (
        <div key={i} className="h-20 bg-muted/30 rounded-md animate-pulse"></div>
      ))}
  </div>
);
