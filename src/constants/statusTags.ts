export const STATUS_TAGS = [
  { value: "just_listed", label: "Just Listed", colorToken: "primary" },
  { value: "reviewing_buyers", label: "Reviewing Buyers", colorToken: "accent" },
  { value: "in_diligence", label: "In Diligence", colorToken: "secondary" },
  { value: "under_loi", label: "Under LOI", colorToken: "warning" },
  { value: "accepted_offer", label: "Accepted Offer", colorToken: "success" },
] as const;

export const STATUS_TAG_LABELS = STATUS_TAGS.reduce((acc, tag) => {
  acc[tag.value] = tag.label;
  return acc;
}, {} as Record<string, string>);

export type StatusTagValue = typeof STATUS_TAGS[number]['value'] | null;