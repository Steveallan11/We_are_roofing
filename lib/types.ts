import type {
  JOB_STATUSES,
  KNOWLEDGE_BASE_CATEGORIES,
  MATERIAL_REQUIRED_STATUSES,
  PHOTO_TYPES,
  QUOTE_STATUSES,
  ROOF_TYPES,
  SURVEY_TYPES
} from "@/lib/constants";

export type JobStatus = (typeof JOB_STATUSES)[number];
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type PhotoType = (typeof PHOTO_TYPES)[number];
export type MaterialRequiredStatus = (typeof MATERIAL_REQUIRED_STATUSES)[number];
export type KnowledgeBaseCategory = (typeof KNOWLEDGE_BASE_CATEGORIES)[number];
export type SurveyType = (typeof SURVEY_TYPES)[number];
export type RoofType = (typeof ROOF_TYPES)[number];

export type CostLineItem = {
  item: string;
  cost: number;
  vat_applicable: boolean;
  notes: string;
};

export type MaterialLineItem = {
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  required_status: MaterialRequiredStatus;
  notes: string;
  supplier?: string | null;
  estimated_price?: number | null;
  link?: string | null;
};

export type GeneratedQuote = {
  roof_report: string;
  scope_of_works: string;
  cost_breakdown: CostLineItem[];
  subtotal: number;
  vat_amount: number;
  total: number;
  guarantee_text: string;
  exclusions: string;
  terms: string;
  customer_email_subject: string;
  customer_email_body: string;
  missing_info: string[];
  pricing_notes: string[];
  confidence: "Low" | "Medium" | "High";
  materials: MaterialLineItem[];
};

export type SurveyCore = {
  surveyor_name: string;
  access_notes: string;
  scaffold_required: boolean;
  scaffold_notes: string;
  roof_condition: string;
  problem_observed: string;
  suspected_cause: string;
  recommended_works: string;
  measurements: string;
  weather_notes: string;
  safety_notes: string;
  customer_concerns: string;
  voice_note_transcript: string;
  raw_notes: string;
  no_photo_confirmation: boolean;
};

export type FlatRoofDetails = {
  current_surface_type?: string;
  approximate_age?: string;
  length_m?: number | null;
  width_m?: number | null;
  perimeter_m?: number | null;
  roof_area_estimate_m2?: number | null;
  roof_area_override_m2?: number | null;
  deck_condition?: string;
  drainage_condition?: string;
  standing_water?: boolean;
  upstands_condition?: string;
  flashings_condition?: string;
  outlets_count?: number | null;
  rooflights?: string;
  recommended_system?: string;
};

export type PitchedRoofDetails = {
  roof_style?: string;
  roof_style_notes?: string;
  tile_type?: string;
  tile_age?: string;
  tile_condition?: string;
  tile_issues?: string[];
  missing_tiles?: number | null;
  pitch_angle_deg?: number | null;
  ridge_length_m?: number | null;
  number_of_ridges?: number | null;
  total_ridge_metres?: number | null;
  eaves_length_m?: number | null;
  verge_length_m?: number | null;
  rafter_length_m?: number | null;
  hip_count?: number | null;
  total_hip_metres?: number | null;
  valley_count?: number | null;
  total_valley_metres?: number | null;
  roof_area_estimate_m2?: number | null;
  roof_area_override_m2?: number | null;
  ridge_type?: string;
  ridge_condition?: string;
  hip_type?: string;
  hip_condition?: string;
  valley_type?: string;
  valley_condition?: string;
  verge_type?: string;
  verge_condition?: string;
  eaves_ventilation?: string;
  bird_guard_present?: boolean;
  membrane_type?: string;
  felt_condition?: string;
  batten_condition?: string;
  batten_notes?: string;
  chimney_present?: boolean;
  chimney_condition?: string;
  chimney_flashings_condition?: string;
  chimney_flaunching_condition?: string;
  chimney_pots?: string;
  chimney_cowls?: boolean;
  chimney_repointing_needed?: boolean;
  solar_panels?: boolean;
  solar_panel_count?: number | null;
  roof_windows?: boolean;
  roof_window_count?: number | null;
  aerial_present?: boolean;
  satellite_present?: boolean;
  vents_present?: boolean;
  moss_level?: string;
  moss_treatment_recommended?: boolean;
  loft_inspected?: boolean;
  loft_daylight_visible?: boolean;
  loft_damp_patches?: boolean;
  loft_condensation?: boolean;
  loft_insulation_type?: string;
  loft_insulation_depth_mm?: number | null;
  loft_notes?: string;
  scaffold_type?: string;
  scaffold_elevations?: string;
  access_notes?: string;
};

export type FasciaDetails = {
  current_material?: string;
  fascia_condition?: string;
  soffit_condition?: string;
  guttering_condition?: string;
  downpipe_condition?: string;
  colour_preference?: string;
  front_run_m?: number | null;
  rear_run_m?: number | null;
  left_run_m?: number | null;
  right_run_m?: number | null;
  total_linear_metres?: number | null;
  total_linear_metres_override?: number | null;
  gutter_profile?: string;
  cladding_details?: string;
};

export type ChimneyDetails = {
  chimney_count?: number | null;
  chimney_condition?: string;
  flaunching_condition?: string;
  lead_flashings_condition?: string;
  gas_flue_present?: boolean;
  parapet_or_coping?: boolean;
  chimney_pots?: string;
  chimney_cowls?: boolean;
  repointing_needed?: boolean;
  lead_code?: string;
  apron_length_m?: number | null;
  back_gutter_length_m?: number | null;
  step_flashing_length_m?: number | null;
  total_measured_run_m?: number | null;
  total_measured_run_override_m?: number | null;
  height_or_access_notes?: string;
  additional_notes?: string;
};

export type OtherSurveyDetails = {
  survey_focus?: string;
  measured_area_m2?: number | null;
  measured_run_m?: number | null;
  recommended_system?: string;
  issue_tags?: string[];
  additional_findings?: string;
};

export type SurveyAdaptiveSections = {
  flat_roof?: FlatRoofDetails;
  pitched_roof?: PitchedRoofDetails;
  fascias?: FasciaDetails;
  chimney?: ChimneyDetails;
  other?: OtherSurveyDetails;
};

export type SurveyPayload = {
  survey_type: SurveyType;
  roof_type: RoofType;
  core: SurveyCore;
  flat_roof?: FlatRoofDetails;
  pitched_roof?: PitchedRoofDetails;
  fascias?: FasciaDetails;
  chimney?: ChimneyDetails;
  other?: OtherSurveyDetails;
};

export type DashboardStats = {
  totalJobs: number;
  readyForQuote: number;
  readyToSend: number;
  quoteSent: number;
  materialsNeeded: number;
};

export type KanbanColumn = {
  status: JobStatus;
  label?: string;
  description?: string;
  jobs: Job[];
};

export type Business = {
  id: string;
  business_name: string;
  trading_address: string;
  phone: string;
  email: string;
  website: string;
  logo_url?: string | null;
  vat_registered: boolean;
  vat_rate: number;
  company_number?: string | null;
  payment_terms: string;
  quote_valid_days: number;
};

export type Customer = {
  id: string;
  business_id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  notes?: string | null;
  created_at?: string;
};

export type Job = {
  id: string;
  business_id: string;
  customer_id: string;
  job_ref?: string | null;
  job_title: string;
  property_address: string;
  postcode?: string | null;
  job_type?: string | null;
  roof_type?: string | null;
  status: JobStatus;
  urgency?: string | null;
  source?: string | null;
  survey_date?: string | null;
  quote_sent_at?: string | null;
  follow_up_date?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  estimated_value?: number | null;
  final_value?: number | null;
  internal_notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SurveyRecord = {
  id: string;
  job_id: string;
  surveyor_name?: string | null;
  access_notes?: string | null;
  scaffold_required: boolean;
  scaffold_notes?: string | null;
  roof_condition?: string | null;
  problem_observed?: string | null;
  suspected_cause?: string | null;
  recommended_works?: string | null;
  measurements?: string | null;
  weather_notes?: string | null;
  safety_notes?: string | null;
  customer_concerns?: string | null;
  voice_note_transcript?: string | null;
  raw_notes?: string | null;
  survey_type?: string | null;
  roof_type?: string | null;
  no_photo_confirmation: boolean;
  adaptive_sections?: SurveyAdaptiveSections;
  created_at?: string;
  updated_at?: string;
};

export type JobPhoto = {
  id: string;
  job_id: string;
  survey_id?: string | null;
  storage_path: string;
  public_url?: string | null;
  photo_type: PhotoType;
  caption?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  created_at?: string;
  uploaded_at?: string;
};

export type QuoteRecord = {
  id: string;
  job_id: string;
  quote_ref: string;
  version_number: number;
  roof_report: string;
  scope_of_works: string;
  cost_breakdown: CostLineItem[];
  subtotal: number;
  vat_amount: number;
  total: number;
  guarantee_text?: string | null;
  exclusions?: string | null;
  terms?: string | null;
  customer_email_subject?: string | null;
  customer_email_body?: string | null;
  status: QuoteStatus;
  pdf_url?: string | null;
  sent_at?: string | null;
  missing_info: string[];
  pricing_notes: string[];
  confidence?: string | null;
  model_name?: string | null;
  prompt_version?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MaterialRecord = MaterialLineItem & {
  id: string;
  job_id: string;
  quote_id?: string | null;
  created_at?: string;
};

export type KnowledgeBaseRecord = {
  id: string;
  business_id: string;
  title: string;
  category: KnowledgeBaseCategory;
  content: string;
  source_type?: string | null;
  tags: string[];
  created_at?: string;
  updated_at?: string;
};

export type HistoricalQuoteRecord = {
  id: string;
  business_id: string;
  title: string;
  source_reference?: string | null;
  source_record_id?: string | null;
  source_url?: string | null;
  source_type: string;
  source_date?: string | null;
  source_year?: number | null;
  roof_type?: string | null;
  job_type?: string | null;
  tags: string[];
  imported_text: string;
  scope_excerpt?: string | null;
  materials_excerpt?: string | null;
  original_total?: number | null;
  uplifted_reference_total?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type PricingRuleRecord = {
  id: string;
  business_id: string;
  title: string;
  year_from?: number | null;
  year_to?: number | null;
  roof_type?: string | null;
  job_type?: string | null;
  uplift_multiplier: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type JobDocumentRecord = {
  id: string;
  job_id: string;
  quote_id?: string | null;
  document_type: string;
  display_name: string;
  storage_bucket?: string | null;
  storage_path?: string | null;
  public_url?: string | null;
  source_type: string;
  mime_type?: string | null;
  file_size?: number | null;
  content_html?: string | null;
  created_at?: string;
};

export type QuoteAttachmentRecord = {
  id: string;
  quote_id: string;
  job_photo_id?: string | null;
  job_document_id?: string | null;
  attachment_type: string;
  created_at?: string;
};

export type EmailLog = {
  id: string;
  job_id: string;
  quote_id?: string | null;
  to_email: string;
  subject: string;
  body: string;
  provider_message_id?: string | null;
  sent_at?: string;
  status: string;
};

export type JobBundle = {
  business: Business;
  customer: Customer;
  job: Job;
  survey?: SurveyRecord | null;
  quote?: QuoteRecord | null;
  materials: MaterialRecord[];
  photos: JobPhoto[];
  documents: JobDocumentRecord[];
  email_logs: EmailLog[];
};
