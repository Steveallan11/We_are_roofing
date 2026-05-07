export const JOB_STATUSES = [
  "New Lead",
  "Survey Needed",
  "Survey Complete",
  "Ready For AI Quote",
  "Quote Drafted",
  "Ready To Send",
  "Quote Sent",
  "Follow-Up Needed",
  "Accepted",
  "Materials Needed",
  "Booked",
  "Completed",
  "Lost",
  "Archived"
] as const;

export const QUOTE_STATUSES = ["Draft", "Needs Review", "Approved", "Sent", "Accepted", "Declined"] as const;

export const PHOTO_TYPES = ["General", "Damage", "Roof Area", "Access", "Scaffold", "Before", "After", "Other"] as const;

export const MATERIAL_REQUIRED_STATUSES = [
  "Definitely Needed",
  "May Be Needed",
  "Optional",
  "Check On Site"
] as const;

export const KNOWLEDGE_BASE_CATEGORIES = [
  "Quote Template",
  "Pricing Reference",
  "Scope Of Works",
  "Roof Report Style",
  "Materials System",
  "Terms",
  "Historical Quote",
  "Email Style",
  "Supplier Info"
] as const;

export const SURVEY_TYPES = [
  "Flat Roof",
  "Pitched / Tiled",
  "Fascias / Soffits / Gutters",
  "Chimney / Lead",
  "Other / Misc"
] as const;

export const ROOF_TYPES = ["Flat", "Pitched", "Slate", "Tile", "Fascia", "Chimney", "Mixed", "Other"] as const;

