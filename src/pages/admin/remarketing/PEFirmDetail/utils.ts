export const getFirmTypeLabel = (type: string | null) => {
  const labels: Record<string, string> = {
    pe_firm: "PE Firm",
    independent_sponsor: "Independent Sponsor",
    search_fund: "Search Fund",
    family_office: "Family Office",
  };
  return labels[type || ""] || type || "Sponsor";
};
