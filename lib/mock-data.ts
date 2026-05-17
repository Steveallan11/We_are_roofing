import type {
  Business,
  Customer,
  DashboardStats,
  InvoiceRecord,
  Job,
  JobBundle,
  JobPhoto,
  KnowledgeBaseRecord,
  MaterialRecord,
  QuoteRecord,
  SurveyRecord
} from "@/lib/types";
import { KNOWLEDGE_BASE_SEEDS } from "@/lib/seed-data";

export const MOCK_BUSINESS: Business = {
  id: "11111111-1111-1111-1111-111111111111",
  business_name: "We Are Roofing UK Ltd",
  trading_address: "Yateley, Hampshire, GU46",
  phone: "01252 000000",
  email: "hello@weareroofing.co.uk",
  website: "https://weareroofing.co.uk",
  logo_url: "/we-are-roofing-logo.png",
  vat_registered: true,
  vat_rate: 20,
  company_number: "PLACEHOLDER",
  payment_terms: "Payment terms are strictly upon receipt of invoice",
  quote_valid_days: 30
};

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "cust-1",
    business_id: MOCK_BUSINESS.id,
    first_name: "Sarah",
    last_name: "Mitchell",
    full_name: "Sarah Mitchell",
    phone: "07700 900111",
    email: "sarah.mitchell@example.com",
    address_line_1: "14 Oakfield Rise",
    town: "Fleet",
    county: "Hampshire",
    postcode: "GU51 4AB"
  },
  {
    id: "cust-2",
    business_id: MOCK_BUSINESS.id,
    first_name: "David",
    last_name: "Clarke",
    full_name: "David Clarke",
    phone: "07700 900222",
    email: "david.clarke@example.com",
    address_line_1: "8 Beech Close",
    town: "Yateley",
    county: "Hampshire",
    postcode: "GU46 6QL"
  }
];

export const MOCK_JOBS: Job[] = [
  {
    id: "job-1",
    business_id: MOCK_BUSINESS.id,
    customer_id: "cust-1",
    job_title: "Rear extension flat roof replacement",
    property_address: "14 Oakfield Rise, Fleet, Hampshire",
    postcode: "GU51 4AB",
    job_type: "Replacement",
    roof_type: "Flat",
    status: "Ready For AI Quote",
    urgency: "Medium",
    source: "Referral",
    estimated_value: 4200,
    internal_notes: "Customer wants a clean written explanation for moisture around the outlet.",
    created_at: "2026-05-05T09:30:00.000Z",
    updated_at: "2026-05-06T18:15:00.000Z"
  },
  {
    id: "job-2",
    business_id: MOCK_BUSINESS.id,
    customer_id: "cust-2",
    job_title: "Front ridge and hip repairs",
    property_address: "8 Beech Close, Yateley, Hampshire",
    postcode: "GU46 6QL",
    job_type: "Repair",
    roof_type: "Tile",
    status: "Ready To Send",
    urgency: "High",
    source: "Phone Call",
    estimated_value: 1850,
    created_at: "2026-05-04T08:15:00.000Z",
    updated_at: "2026-05-06T16:40:00.000Z"
  },
  {
    id: "job-3",
    business_id: MOCK_BUSINESS.id,
    customer_id: "cust-1",
    job_title: "UPVC fascia and gutter replacement",
    property_address: "14 Oakfield Rise, Fleet, Hampshire",
    postcode: "GU51 4AB",
    job_type: "Replacement",
    roof_type: "Fascia",
    status: "Quote Sent",
    urgency: "Low",
    source: "Website",
    quote_sent_at: "2026-05-03T13:00:00.000Z",
    estimated_value: 2900,
    created_at: "2026-05-02T10:00:00.000Z",
    updated_at: "2026-05-03T13:00:00.000Z"
  }
];

export const MOCK_SURVEYS: SurveyRecord[] = [
  {
    id: "survey-1",
    job_id: "job-1",
    surveyor_name: "Andrew Bailey",
    access_notes: "Rear garden access is clear. Tower not enough because of extension width.",
    scaffold_required: true,
    scaffold_notes: "Front and rear scaffold likely required for safe strip and re-cover.",
    roof_condition: "Poor",
    problem_observed: "Standing water around rear outlet and lifting felt at upstands.",
    suspected_cause: "Aged felt system with weak drainage detail and likely soft decking around outlet.",
    recommended_works: "Full strip, inspect deck, reboard as needed, Danosa two-layer torch-on replacement.",
    measurements: "Length 5.8m x width 3.4m. Approx 19.7m2. One outlet, 7m flashings.",
    weather_notes: "Dry on site. No active rain during inspection.",
    safety_notes: "Extension edge close to conservatory roof. Require controlled access.",
    customer_concerns: "Customer wants long-term solution, not a patch repair.",
    voice_note_transcript: "Rear corner is the weakest point. Softness around outlet needs allowing for.",
    raw_notes: "Danosa Option 3 feels right here. Possible local deck replacement.",
    survey_type: "Flat Roof",
    roof_type: "Flat",
    no_photo_confirmation: false,
    adaptive_sections: {
      flat_roof: {
        current_surface_type: "Felt",
        approximate_age: "20+ years",
        deck_condition: "Some Soft Spots",
        drainage_condition: "Partially Blocked",
        standing_water: true,
        upstands_condition: "Cracking / Lifting",
        flashings_condition: "Needs Attention",
        rooflights: "None",
        recommended_system: "Danosa Option 3 — 2 Layer Torch-On"
      }
    },
    created_at: "2026-05-05T10:00:00.000Z",
    updated_at: "2026-05-05T10:30:00.000Z"
  },
  {
    id: "survey-2",
    job_id: "job-2",
    surveyor_name: "Andrew Bailey",
    access_notes: "Front elevation reachable from scaffold tower if customer accepts.",
    scaffold_required: false,
    scaffold_notes: "",
    roof_condition: "Fair",
    problem_observed: "Loose ridge mortar and movement to first hip section.",
    suspected_cause: "Weathered mortar bedding and local movement.",
    recommended_works: "Remove loose sections and renew ridge/hip bedding where required.",
    measurements: "Approx 7m ridge and 2.5m hip.",
    weather_notes: "",
    safety_notes: "",
    customer_concerns: "Wants a tidy repair before water gets worse.",
    voice_note_transcript: "",
    raw_notes: "Can be quoted as a focused repair.",
    survey_type: "Pitched / Tiled",
    roof_type: "Tile",
    no_photo_confirmation: false,
    adaptive_sections: {
      pitched_roof: {
        tile_type: "Concrete Interlocking",
        ridge_type: "Mortar Bedded",
        valley_type: "No Valley",
        missing_tiles: 3,
        felt_condition: "Perished in Places",
        solar_panels: false,
        chimney_present: true
      }
    },
    created_at: "2026-05-04T09:15:00.000Z",
    updated_at: "2026-05-04T09:45:00.000Z"
  }
];

export const MOCK_PHOTOS: JobPhoto[] = [
  {
    id: "photo-1",
    job_id: "job-1",
    survey_id: "survey-1",
    storage_path: "business/job-1/survey-1/rear-outlet.jpg",
    public_url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
    photo_type: "Damage",
    caption: "Standing water around rear outlet"
  },
  {
    id: "photo-2",
    job_id: "job-1",
    survey_id: "survey-1",
    storage_path: "business/job-1/survey-1/upstand.jpg",
    public_url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
    photo_type: "Roof Area",
    caption: "General roof area and felt condition"
  }
];

export const MOCK_QUOTES: QuoteRecord[] = [
  {
    id: "quote-2",
    job_id: "job-2",
    quote_ref: "WR-Q-1002",
    version_number: 1,
    roof_report:
      "Having been out to look at the roof of the above property we found local movement to the front ridge line together with loose mortar at the first hip section. The tile covering itself is generally serviceable, but the bedding has broken down and now needs attention before water penetrates further.",
    scope_of_works:
      "Carefully remove all loose ridge and hip sections to the affected area, clean down the bed, renew mortar bedding, resecure the ridge/hip tiles, and leave the area clean and watertight.",
    cost_breakdown: [
      { item: "Main works", cost: 1450, vat_applicable: true, notes: "Renew ridge and hip bedding" },
      { item: "Access tower allowance", cost: 400, vat_applicable: true, notes: "Only if required on the day" }
    ],
    subtotal: 1850,
    vat_amount: 370,
    total: 2220,
    guarantee_text: "This repair carries a 12-month workmanship guarantee to the affected area.",
    exclusions: "Any hidden tile breakages found once opened up are excluded.",
    terms: "Payment due on receipt. Materials remain property of We Are Roofing UK Ltd until paid in full.",
    customer_email_subject: "Your We Are Roofing quotation",
    customer_email_body: "Please find our quotation for the ridge and hip repair works discussed on site.",
    status: "Approved",
    missing_info: [],
    pricing_notes: ["Access cost should stay separate if tower not needed."],
    confidence: "High",
    model_name: "manual-draft",
    prompt_version: "v1"
  },
  {
    id: "quote-3",
    job_id: "job-3",
    quote_ref: "WR-Q-1003",
    version_number: 1,
    roof_report:
      "Having been out to look at the roofline of the above property we noted aging fascia boards, tired guttering, and areas where the present installation is no longer performing cleanly.",
    scope_of_works:
      "Remove existing fascia, soffit and guttering to the agreed elevations and replace with new UPVC roofline system including guttering and downpipes.",
    cost_breakdown: [
      { item: "Main works", cost: 2400, vat_applicable: true, notes: "UPVC roofline replacement" },
      { item: "Waste", cost: 500, vat_applicable: true, notes: "Removal and disposal allowance" }
    ],
    subtotal: 2900,
    vat_amount: 580,
    total: 3480,
    guarantee_text: "Manufacturer-backed system with workmanship guarantee.",
    exclusions: "Hidden structural timber defects are excluded unless identified during works.",
    terms: "Payment due on receipt.",
    customer_email_subject: "Your fascia and gutter quotation",
    customer_email_body: "Please find our approved quotation below.",
    status: "Sent",
    sent_at: "2026-05-03T13:00:00.000Z",
    missing_info: [],
    pricing_notes: [],
    confidence: "Medium",
    model_name: "manual-draft",
    prompt_version: "v1"
  }
];

export const MOCK_MATERIALS: MaterialRecord[] = [
  {
    id: "mat-1",
    job_id: "job-2",
    quote_id: "quote-2",
    item_name: "Ridge mortar",
    category: "Repair",
    quantity: 6,
    unit: "bags",
    required_status: "Definitely Needed",
    notes: "Allow for ridge and first hip section"
  },
  {
    id: "mat-2",
    job_id: "job-1",
    quote_id: null,
    item_name: "Danosa Option 3 system",
    category: "Flat Roof",
    quantity: 20,
    unit: "m2",
    required_status: "May Be Needed",
    notes: "Pending final quote generation"
  }
];

export const MOCK_INVOICES: InvoiceRecord[] = [
  {
    id: "invoice-1",
    business_id: MOCK_BUSINESS.id,
    job_id: "job-3",
    quote_id: "quote-3",
    invoice_ref: "WR-I-1001",
    status: "Sent",
    issue_date: "2026-05-05",
    due_date: "2026-05-05",
    line_items: [
      {
        description: "UPVC roofline replacement",
        quantity: 1,
        unit: "job",
        unit_price: 2900,
        vat_applicable: true,
        total: 2900
      }
    ],
    subtotal: 2900,
    vat_amount: 580,
    total: 3480,
    amount_paid: 0,
    balance_due: 3480,
    payment_terms: MOCK_BUSINESS.payment_terms
  }
];

export const MOCK_KNOWLEDGE_BASE: KnowledgeBaseRecord[] = KNOWLEDGE_BASE_SEEDS.map((record, index) => ({
  id: `kb-${index + 1}`,
  business_id: MOCK_BUSINESS.id,
  title: record.title,
  category: record.category,
  content: record.content,
  source_type: record.source_type,
  tags: record.tags
}));

export function getMockBundle(jobId: string): JobBundle | null {
  const job = MOCK_JOBS.find((item) => item.id === jobId);
  if (!job) return null;

  const customer = MOCK_CUSTOMERS.find((item) => item.id === job.customer_id);
  if (!customer) return null;

  return {
    business: MOCK_BUSINESS,
    customer,
    job,
    survey: MOCK_SURVEYS.find((item) => item.job_id === jobId) ?? null,
    quote: [...MOCK_QUOTES].reverse().find((item) => item.job_id === jobId) ?? null,
    invoices: MOCK_INVOICES.filter((item) => item.job_id === jobId),
    materials: MOCK_MATERIALS.filter((item) => item.job_id === jobId),
    photos: MOCK_PHOTOS.filter((item) => item.job_id === jobId),
    documents: [],
    email_logs: []
  };
}

export function getMockDashboardStats(): DashboardStats {
  return {
    totalJobs: MOCK_JOBS.length,
    readyForQuote: MOCK_JOBS.filter((job) => job.status === "Ready For AI Quote").length,
    readyToSend: MOCK_JOBS.filter((job) => job.status === "Ready To Send").length,
    quoteSent: MOCK_JOBS.filter((job) => job.status === "Quote Sent").length,
    materialsNeeded: MOCK_JOBS.filter((job) => job.status === "Materials Needed").length
  };
}
