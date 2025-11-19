interface ListingIdBadgeProps {
  listingId: string;
  showConfidential?: boolean;
}

export function ListingIdBadge({ listingId, showConfidential = true }: ListingIdBadgeProps) {
  // Generate SC-2025-XXX format from listing ID
  const generateListingCode = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const code = String(hash).slice(-3).padStart(3, '0');
    return `SC-2025-${code}`;
  };

  const listingCode = generateListingCode(listingId);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200">
        <span className="text-xs font-semibold text-slate-700 tracking-wide">
          {listingCode}
        </span>
      </div>
      {showConfidential && (
        <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200">
          <span className="text-xs font-semibold text-slate-700 tracking-wide">
            CONFIDENTIAL
          </span>
        </div>
      )}
    </div>
  );
}
