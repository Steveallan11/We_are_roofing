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
export type InvoiceStatus = "Draft" | "Sent" | "Part Paid" | "Paid" | "Overdue" | "Void";
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
  quantity?: number;
  unit?: string;
  unit_rate?: number;
  pricing_source?: string;
  pricing_category?: string;
  quote_section?: string;
  measurement_label?: string;
  source_id?: string;
  source_type?: "section" | "line" | "feature" | string;
  source_label?: string;
  source_color?: string;
  takeoff_notes?: string;
};

export type QuoteOption = {
  id: string;
  label: string;
  option_type?: "standard_scaffold" | "temporary_roof_protection" | string;
  title?: string;
  short_description?: string;
  description: string;
  cost_breakdown: CostLineItem[];
  subtotal: number;
  vat_amount: number;
  total: number;
  recommended: boolean;
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
  weather_location?: string | null;
  bank_name?: string | null;
  bank_sort_code?: string | null;
  bank_account?: string | null;
  bank_account_name?: string | null;
};

export type Customer = {
  id: string;
  business_id: string;
  customer_type?: "person" | "business" | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  business_name?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_person_name?: string | null;
  contact_person_phone?: string | null;
  contact_person_email?: string | null;
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
  survey_time?: string | null;
  survey_duration?: number | null;
  survey_confirmed?: boolean | null;
  survey_notes?: string | null;
  survey_address?: string | null;
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_end_date?: string | null;
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

export type BookingRecord = {
  id: string;
  business_id?: string | null;
  job_id?: string | null;
  booking_type: "survey" | "start" | "inspection" | "other";
  title?: string | null;
  date: string;
  time_start?: string | null;
  time_end?: string | null;
  duration_mins?: number | null;
  address?: string | null;
  postcode?: string | null;
  notes?: string | null;
  status: "tentative" | "confirmed" | "completed" | "cancelled" | "rescheduled";
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  reschedule_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  job?: Job | null;
  customer?: Customer | null;
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
  source_type?: "manual" | "video" | "voice" | "glasses_import" | null;
  video_path?: string | null;
  video_duration_sec?: number | null;
  frames_extracted?: number | null;
  frame_paths?: string[] | null;
  ai_confidence?: number | null;
  ai_field_confidence?: Record<string, number> | null;
  ai_review_items?: Array<Record<string, unknown>> | null;
  ai_raw_response?: Record<string, unknown> | null;
  processing_status?: "pending" | "processing" | "complete" | "failed" | null;
  processing_error?: string | null;
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
  options?: QuoteOption[] | null;
  accepted_option_id?: string | null;
  guarantee_text?: string | null;
  exclusions?: string | null;
  terms?: string | null;
  customer_email_subject?: string | null;
  customer_email_body?: string | null;
  status: QuoteStatus;
  public_token?: string | null;
  public_token_created_at?: string | null;
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
  unit_cost?: number | null;
  total_cost?: number | null;
  actual_price?: number | null;
  margin_pct?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type LabourRateRecord = {
  id: string;
  business_id: string;
  role_name: string;
  cost_rate: number;
  charge_rate: number;
  unit: "hour" | "day";
  default_margin_pct?: number | null;
  active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LabourPersonRecord = {
  id: string;
  business_id: string;
  full_name: string;
  worker_type: "staff" | "subcontractor" | "agency" | "other";
  primary_role?: string | null;
  phone?: string | null;
  email?: string | null;
  company_name?: string | null;
  day_rate_cost?: number | null;
  day_rate_charge?: number | null;
  hourly_rate_cost?: number | null;
  hourly_rate_charge?: number | null;
  skills?: string[] | null;
  emergency_contact?: string | null;
  insurance_notes?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LabourEntryRecord = {
  id: string;
  plan_id: string;
  job_id: string;
  labour_rate_id?: string | null;
  person_id?: string | null;
  role_name: string;
  people: number;
  duration: number;
  unit: "hour" | "day";
  cost_rate: number;
  charge_rate: number;
  estimated_cost: number;
  charge_total: number;
  actual_duration?: number | null;
  actual_cost?: number | null;
  notes?: string | null;
  sort_order?: number | null;
  created_at?: string;
  updated_at?: string;
  person?: LabourPersonRecord | null;
};

export type LabourPlanRecord = {
  id: string;
  job_id: string;
  quote_id?: string | null;
  business_id?: string | null;
  title?: string | null;
  status: "estimated" | "booked" | "in_progress" | "completed";
  crew_confirmed?: boolean | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  entries?: LabourEntryRecord[];
};

export type SupplierRecord = {
  id: string;
  business_id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  account_ref?: string | null;
  notes?: string | null;
  categories?: string[] | null;
  is_preferred?: boolean | null;
  created_at?: string;
};

export type QuoteMessageRecord = {
  id: string;
  quote_id: string;
  job_id?: string | null;
  sender_type: "customer" | "admin";
  sender_name?: string | null;
  sender_email?: string | null;
  message: string;
  read_at?: string | null;
  created_at?: string;
};

export type ConversationChannel = "email" | "sms" | "whatsapp" | "google_business" | "facebook" | "instagram" | "platform";
export type ConversationStatus = "open" | "snoozed" | "resolved" | "spam";
export type MessageDirection = "inbound" | "outbound";
export type MessageSenderType = "customer" | "admin" | "system" | "ai";
export type MessageDeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export type ConversationRecord = {
  id: string;
  business_id?: string | null;
  customer_id?: string | null;
  job_id?: string | null;
  quote_id?: string | null;
  primary_channel: ConversationChannel;
  subject?: string | null;
  status: ConversationStatus;
  unread_count: number;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  snoozed_until?: string | null;
  assigned_to?: string | null;
  created_at?: string;
  updated_at?: string;
  customer?: Customer | null;
  job?: Job | null;
  quote?: QuoteRecord | null;
};

export type MessageRecord = {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  channel: ConversationChannel;
  sender_type: MessageSenderType;
  sender_name?: string | null;
  sender_email?: string | null;
  sender_phone?: string | null;
  body: string;
  subject?: string | null;
  html_body?: string | null;
  attachments?: Array<Record<string, unknown>>;
  provider?: string | null;
  provider_msg_id?: string | null;
  status: MessageDeliveryStatus;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  created_at?: string;
};

export type MessageTemplateRecord = {
  id: string;
  business_id?: string | null;
  name: string;
  category?: string | null;
  channels?: string[] | null;
  subject?: string | null;
  body: string;
  is_auto: boolean;
  trigger_event?: string | null;
  is_active: boolean;
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
  rule_name?: string | null;
  rule_type?: string | null;
  conditions?: Record<string, unknown> | null;
  flat_adjustment?: number | null;
  active?: boolean | null;
  year_from?: number | null;
  year_to?: number | null;
  roof_type?: string | null;
  job_type?: string | null;
  uplift_multiplier: number;
  notes?: string | null;
  preferred_supplier_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type JobDocumentRecord = {
  id: string;
  job_id: string;
  quote_id?: string | null;
  invoice_id?: string | null;
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
  analysis_data?: Record<string, any> | null;
  analysis_status?: string | null;
  analysis_created_at?: string | null;
};

export type QuoteAttachmentRecord = {
  id: string;
  quote_id: string;
  job_photo_id?: string | null;
  job_document_id?: string | null;
  attachment_type: string;
  created_at?: string;
};

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_applicable: boolean;
  total: number;
};

export type InvoiceRecord = {
  id: string;
  business_id: string;
  job_id: string;
  quote_id?: string | null;
  invoice_ref: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  vat_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  notes?: string | null;
  payment_terms?: string | null;
  pdf_url?: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EmailLog = {
  id: string;
  job_id?: string | null;
  quote_id?: string | null;
  to_email?: string | null;
  subject: string;
  body: string;
  provider_message_id?: string | null;
  sent_at?: string;
  status: string;
  template_type?: string | null;
  channel?: "email" | "sms" | null;
  to_phone?: string | null;
  scheduled_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  resend_id?: string | null;
  twilio_sid?: string | null;
  sequence_day?: number | null;
};

export type PaymentScheduleRecord = {
  id: string;
  job_id: string;
  quote_id?: string | null;
  business_id?: string | null;
  created_at?: string;
  stages?: PaymentStageRecord[];
};

export type PaymentStageRecord = {
  id: string;
  schedule_id: string;
  job_id: string;
  stage_name: string;
  stage_number: number;
  percentage?: number | null;
  amount?: number | null;
  due_trigger?: string | null;
  due_date?: string | null;
  status: "pending" | "invoiced" | "paid" | "overdue";
  invoice_id?: string | null;
  paid_at?: string | null;
  payment_ref?: string | null;
  notes?: string | null;
  created_at?: string;
};

export type JobBundle = {
  business: Business;
  customer: Customer;
  job: Job;
  survey?: SurveyRecord | null;
  quote?: QuoteRecord | null;
  invoices: InvoiceRecord[];
  materials: MaterialRecord[];
  labour_plan?: LabourPlanRecord | null;
  photos: JobPhoto[];
  documents: JobDocumentRecord[];
  email_logs: EmailLog[];
};
