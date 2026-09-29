import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeToolCall } from "@/lib/assistant/toolHandlers";

type McpServerContext = {
  userId: string;
  businessId: string;
};

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};

const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
};

const DESTRUCTIVE_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false
};

const EXTERNAL_DESTRUCTIVE_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true
};

const FINANCIAL_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false
};

const PIPELINE_STATUSES = [
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
  "Materials Ordered",
  "Scaffold In Situ",
  "Booked",
  "In Progress",
  "Completed",
  "Not Proceeding",
  "Lost"
] as const;

const OAUTH_SECURITY_SCHEMES = [{ type: "oauth2", scopes: ["openid", "email", "profile"] }];

const OAUTH_TOOL_META = {
  securitySchemes: OAUTH_SECURITY_SCHEMES
};

function toolResponse(result: Awaited<ReturnType<typeof executeToolCall>>) {
  const payload = {
    ok: result.ok,
    summary: result.summary,
    data: result.data
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }]
  };
}

function toolError(error: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          ok: false,
          summary: "The finance request could not be completed safely.",
          error: error instanceof Error ? error.message : "The tool could not be completed."
        })
      }
    ],
    isError: true
  };
}

async function runTool(toolName: string, input: Record<string, unknown>, context: McpServerContext) {
  const startedAt = Date.now();
  try {
    const result = await executeToolCall(toolName, input, {
      pathname: "/mcp",
      businessId: context.businessId,
      actorId: context.userId
    });
    console.info("MCP tool completed", {
      toolName,
      userId: context.userId,
      success: true,
      durationMs: Date.now() - startedAt
    });
    return toolResponse(result);
  } catch (error) {
    console.error("MCP tool failed", {
      toolName,
      userId: context.userId,
      success: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    });
    return toolError(error);
  }
}

export function createRoofingMcpServer(context: McpServerContext) {
  const server = new McpServer({
    name: "we-are-roofing",
    version: "0.4.0"
  });

  server.registerTool(
    "get_jobs",
    {
      title: "Find jobs",
      description: "Find roofing jobs by pipeline status, customer name, or overdue follow-up.",
      inputSchema: {
        status: z.string().optional().describe("Exact pipeline status to match."),
        customer_name: z.string().optional().describe("All or part of the customer name."),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum number of jobs to return."),
        overdue_followup: z.boolean().optional().describe("Only return jobs with an overdue follow-up date.")
      },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_jobs", input, context)
  );

  server.registerTool(
    "get_job_detail",
    {
      title: "Get job details",
      description: "Get a roofing job with its customer, latest survey, latest quote, and materials.",
      inputSchema: {
        job_ref: z.string().optional().describe("The visible job reference, for example WR-J-1005."),
        job_id: z.string().uuid().optional().describe("The internal job UUID, when known.")
      },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_job_detail", input, context)
  );

  server.registerTool(
    "search_customers",
    {
      title: "Search customers",
      description: "Search customers by name, phone number, email address, or postcode.",
      inputSchema: {
        query: z.string().optional().describe("Customer name, phone, email, or postcode to find."),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum number of customers to return.")
      },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("search_customers", input, context)
  );

  server.registerTool(
    "get_customer_jobs",
    {
      title: "Get a customer's jobs",
      description: "Get every roofing job belonging to a named customer.",
      inputSchema: {
        customer_name: z.string().min(1).describe("All or part of the customer's name.")
      },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_customer_jobs", input, context)
  );

  const quoteLineChange = z.object({
    action: z.enum(["add", "update", "remove"]).describe("Add a new line, update an existing line, or remove an existing line."),
    option_id: z.string().trim().min(1).optional().describe("Target quote option ID. Omit to change the main quote lines."),
    line_number: z.number().int().min(1).optional().describe("One-based line number returned by get_quote_detail. Required for update and remove."),
    item: z.string().trim().min(1).max(500).optional(),
    quantity: z.number().positive().max(100000).optional(),
    unit: z.string().trim().max(50).optional(),
    unit_rate: z.number().nonnegative().max(100000000).optional(),
    cost: z.number().nonnegative().max(100000000).optional().describe("Line net amount when quantity and unit_rate are not supplied."),
    vat_applicable: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional(),
    pricing_category: z.string().trim().max(100).optional(),
    quote_section: z.string().trim().max(200).optional(),
    billed_separately: z.boolean().optional(),
    billed_separately_note: z.string().trim().max(1000).optional()
  });
  const quoteOptionUpdate = z.object({
    option_id: z.string().trim().min(1).describe("Existing option ID returned by get_quote_detail."),
    label: z.string().trim().min(1).max(100).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    short_description: z.string().trim().max(500).optional(),
    description: z.string().trim().max(10000).optional(),
    recommended: z.boolean().optional().describe("When true, this becomes the single recommended option.")
  });
  const quoteUpdateFields = {
    quote_ref: z.string().trim().min(1).max(50).describe("Visible quote reference returned by get_quotes or get_quote_detail."),
    customer_pricing_mode: z.enum(["single", "options", "selectable_items"]).optional().describe("Customer pricing layout: one fixed quote, mutually exclusive A/B options, or individually selectable work items with a running total."),
    roof_report: z.string().trim().max(20000).optional(),
    scope_of_works: z.string().trim().max(30000).optional(),
    guarantee_text: z.string().trim().max(5000).optional(),
    exclusions: z.string().trim().max(10000).optional(),
    terms: z.string().trim().max(10000).optional(),
    customer_email_subject: z.string().trim().max(300).optional(),
    customer_email_body: z.string().trim().max(20000).optional(),
    confidence: z.enum(["Low", "Medium", "High"]).optional(),
    missing_info: z.array(z.string().trim().min(1).max(1000)).max(50).optional().describe("Complete revised list of information still missing from the quote."),
    pricing_note: z.string().trim().min(1).max(2000).optional().describe("Internal pricing note to append without deleting existing notes."),
    line_changes: z.array(quoteLineChange).max(100).optional().describe("Line-level additions, edits or removals. Existing lines not mentioned are preserved."),
    option_updates: z.array(quoteOptionUpdate).max(20).optional().describe("Update existing option names, descriptions and recommendation. Use line_changes with option_id for option pricing.")
  };

  server.registerTool(
    "get_quotes",
    {
      title: "Find quotes",
      description: "Find quotes by quote status or job reference.",
      inputSchema: {
        status: z.string().optional().describe("Exact quote status to match."),
        job_ref: z.string().optional().describe("Job reference to match."),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum number of quotes to return.")
      },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_quotes", input, context)
  );

  server.registerTool(
    "get_quote_detail",
    {
      title: "Get editable quote details",
      description: "Load a complete quote for review before editing, including numbered price lines, options, scope, guarantees, exclusions, terms, customer email text, totals, status and concurrency timestamp.",
      inputSchema: { quote_ref: z.string().trim().min(1).max(50).optional(), job_ref: z.string().trim().min(1).max(50).optional() },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_quote_detail", input, context)
  );

  server.registerTool(
    "preview_quote_update",
    {
      title: "Preview quote changes",
      description: "Preview line-level pricing and wording changes to a draft, review-needed or approved quote. Recalculates VAT and totals but saves nothing. Use this before update_quote.",
      inputSchema: quoteUpdateFields,
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("preview_quote_update", input, context)
  );

  server.registerTool(
    "update_quote",
    {
      title: "Apply reviewed quote changes",
      description: "Apply the exact quote changes already shown by preview_quote_update. Uses an optimistic concurrency timestamp, recalculates VAT and totals, and sends an approved quote back to Needs Review. Sent, accepted and declined quotes cannot be edited.",
      inputSchema: { ...quoteUpdateFields, expected_updated_at: z.string().datetime({ offset: true }).describe("Exact updated_at returned by get_quote_detail or preview_quote_update."), confirmed: z.literal(true).describe("Must be true only after the user reviews and confirms this exact quote preview.") },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("update_quote", input, context)
  );

  server.registerTool(
    "get_pipeline_summary",
    {
      title: "Summarise the jobs pipeline",
      description: "Get job counts and estimated values grouped by pipeline status.",
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async () => runTool("get_pipeline_summary", {}, context)
  );

  server.registerTool(
    "get_overdue_items",
    {
      title: "Find overdue work",
      description: "Find overdue job follow-ups and quotes that have not progressed after seven days.",
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async () => runTool("get_overdue_items", {}, context)
  );

  server.registerTool(
    "create_job",
    {
      title: "Create a job",
      description:
        "Create a new roofing job in New Lead. A customer record is reused when an exact name and phone match, otherwise a new customer is created. Confirm the details with the user before calling.",
      inputSchema: {
        job_title: z.string().trim().min(1).max(200).describe("Short title for the roofing job."),
        property_address: z.string().trim().min(1).max(500).describe("Full address where the work will take place."),
        postcode: z.string().trim().max(20).optional().describe("Property postcode."),
        customer_name: z.string().trim().min(1).max(200).describe("Customer's full name or business name."),
        customer_phone: z.string().trim().max(50).optional().describe("Customer phone number."),
        customer_email: z.string().trim().email().max(320).optional().describe("Customer email address."),
        job_type: z.string().trim().max(100).optional().describe("Type of roofing work."),
        roof_type: z.string().trim().max(100).optional().describe("Roof construction or covering type."),
        urgency: z.string().trim().max(100).optional().describe("Urgency recorded for the job."),
        source: z.string().trim().max(100).optional().describe("How the enquiry was received."),
        internal_notes: z.string().trim().max(5000).optional().describe("Initial internal notes. These are not customer-facing."),
        estimated_value: z.number().nonnegative().max(100000000).optional().describe("Estimated job value in pounds.")
      },
      annotations: WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("create_job", input, context)
  );

  server.registerTool(
    "move_job_pipeline",
    {
      title: "Move a job in the pipeline",
      description:
        "Move an existing roofing job to another active or outcome pipeline status. Use archive_job instead of this tool to archive a job.",
      inputSchema: {
        job_ref: z.string().trim().min(1).max(50).describe("Visible job reference, for example WR-J-1005."),
        new_status: z.enum(PIPELINE_STATUSES).describe("The exact pipeline status to move the job to."),
        internal_note: z.string().trim().max(2000).optional().describe("Optional internal reason or context to append to the job.")
      },
      annotations: WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) =>
      runTool(
        "update_job_status",
        { job_ref: input.job_ref, new_status: input.new_status, internal_notes: input.internal_note },
        context
      )
  );

  server.registerTool(
    "append_job_note",
    {
      title: "Append a job note",
      description:
        "Append a timestamped internal note to a roofing job. Existing notes are preserved and the note is not sent to the customer.",
      inputSchema: {
        job_ref: z.string().trim().min(1).max(50).describe("Visible job reference, for example WR-J-1005."),
        note: z.string().trim().min(1).max(5000).describe("Internal note to append.")
      },
      annotations: WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("update_job_notes", { job_ref: input.job_ref, notes: input.note, mode: "append" }, context)
  );

  server.registerTool(
    "set_job_followup",
    {
      title: "Set a job follow-up",
      description: "Set or change the next follow-up date and time for an existing roofing job.",
      inputSchema: {
        job_ref: z.string().trim().min(1).max(50).describe("Visible job reference, for example WR-J-1005."),
        follow_up_date: z.string().datetime({ offset: true }).describe("Follow-up date and time as an ISO 8601 value with timezone offset.")
      },
      annotations: WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("set_followup_date", input, context)
  );

  server.registerTool(
    "archive_job",
    {
      title: "Archive a job",
      description:
        "Archive an existing roofing job after the user explicitly confirms that specific job. This removes it from the active pipeline but does not delete its records.",
      inputSchema: {
        job_ref: z.string().trim().min(1).max(50).describe("Visible job reference, for example WR-J-1005."),
        reason: z.string().trim().min(1).max(2000).describe("Internal reason for archiving the job."),
        confirmed: z.literal(true).describe("Must be true only after the user explicitly confirms archiving this specific job.")
      },
      annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) =>
      runTool(
        "update_job_status",
        { job_ref: input.job_ref, new_status: "Archived", internal_notes: `Archived: ${input.reason}` },
        context
      )
  );

  server.registerTool(
    "list_literature",
    {
      title: "List customer literature",
      description: "List active brochures, product sheets, guarantees and other literature that can be attached to a customer email.",
      inputSchema: {
        query: z.string().trim().max(200).optional().describe("Optional words from the literature name or description.")
      },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("list_literature", input, context)
  );

  server.registerTool(
    "list_job_documents",
    {
      title: "List files available to email for a job",
      description: "List invoices, quote PDFs, roof reports and other stored documents belonging to one workspace-owned job. Returns exact document IDs for selecting attachments. This does not send anything.",
      inputSchema: {
        job_ref: z.string().trim().min(1).max(50).describe("Visible job reference, for example WR-J-1005."),
        query: z.string().trim().max(200).optional().describe("Optional words, invoice number, quote reference or document type to filter the files.")
      },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("list_job_documents", input, context)
  );

  server.registerTool(
    "draft_customer_email",
    {
      title: "Draft a customer email",
      description:
        "Save an email draft for the customer linked to a roofing job, optionally attaching selected job invoices, quotes, reports, documents and customer literature. This does not send anything. Return the complete preview and draft ID so the user can review the recipient, message and every attachment before any send action.",
      inputSchema: {
        job_ref: z.string().trim().min(1).max(50).describe("Visible job reference, for example WR-J-1005."),
        subject: z.string().trim().min(1).max(300).describe("Customer-facing email subject."),
        body: z.string().trim().min(1).max(20000).describe("Complete plain-text customer email body."),
        literature_names: z.array(z.string().trim().min(1).max(300)).max(10).optional().describe("Exact literature display names returned by list_literature."),
        job_document_ids: z.array(z.string().uuid()).max(20).optional().describe("Exact document IDs returned by list_job_documents. Only documents belonging to this job can be attached.")
      },
      annotations: WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("draft_customer_email", input, context)
  );

  server.registerTool(
    "send_customer_email_draft",
    {
      title: "Send a reviewed customer email draft",
      description:
        "Send one previously saved customer email draft. Call only after showing the exact recipient, subject, body and attachments and receiving explicit user confirmation for this draft.",
      inputSchema: {
        draft_id: z.string().uuid().describe("Draft UUID returned by draft_customer_email."),
        confirmed: z.literal(true).describe("Must be true only after the user explicitly confirms sending the displayed draft.")
      },
      annotations: EXTERNAL_DESTRUCTIVE_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("send_customer_email_draft", input, context)
  );

  const dateField = (label: string) => z.string().date().describe(`${label} as an ISO 8601 date (YYYY-MM-DD), inclusive.`);
  const financeLimit = z.number().int().min(1).max(100).optional().describe("Maximum rows to return; the hard maximum is 100.");

  server.registerTool(
    "get_invoices",
    {
      title: "Find customer invoices",
      description: "Find actual customer invoices by inclusive invoice-date range, status, customer, job reference, invoice number or payment state. Quotes are never treated as invoices or turnover.",
      inputSchema: { start_date: dateField("Start date").optional(), end_date: dateField("End date").optional(), status: z.string().optional(), customer_name: z.string().optional(), job_ref: z.string().optional(), invoice_number: z.string().optional(), unpaid_only: z.boolean().optional(), overdue_only: z.boolean().optional(), limit: financeLimit },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_invoices", input, context)
  );

  server.registerTool(
    "get_invoice_detail",
    {
      title: "Get invoice detail",
      description: "Get one customer invoice with its customer, job, stored line items and VAT, payments, credit notes, balance, notes and dates.",
      inputSchema: { invoice_id: z.string().uuid().optional(), invoice_number: z.string().trim().min(1).optional() },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_invoice_detail", input, context)
  );

  server.registerTool(
    "get_payments",
    {
      title: "Find customer payments",
      description: "Find customer payment receipts using the inclusive payment-date range, with linked invoice, customer and job details plus the total received.",
      inputSchema: { start_date: dateField("Start date").optional(), end_date: dateField("End date").optional(), customer_name: z.string().optional(), job_ref: z.string().optional(), invoice_number: z.string().optional(), payment_method: z.string().optional(), limit: financeLimit },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_payments", input, context)
  );

  server.registerTool(
    "get_supplier_bills",
    {
      title: "Find supplier bills",
      description: "Find supplier bills and purchase liabilities by inclusive bill-date range, supplier, job, status, payment state or expense category.",
      inputSchema: { start_date: dateField("Start date").optional(), end_date: dateField("End date").optional(), supplier_name: z.string().optional(), job_ref: z.string().optional(), status: z.string().optional(), unpaid_only: z.boolean().optional(), overdue_only: z.boolean().optional(), expense_category: z.string().optional(), limit: financeLimit },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_supplier_bills", input, context)
  );

  server.registerTool(
    "get_expenses",
    {
      title: "Find business expenses",
      description: "Find miscellaneous business and job expenses by inclusive expense-date range, job, supplier or category, including stored net, VAT and gross amounts.",
      inputSchema: { start_date: dateField("Start date").optional(), end_date: dateField("End date").optional(), job_ref: z.string().optional(), supplier_name: z.string().optional(), category: z.string().optional(), limit: financeLimit },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_expenses", input, context)
  );

  server.registerTool(
    "get_job_financials",
    {
      title: "Get job financials",
      description: "Get the financial performance of a roofing job, including contract and variations, actual invoices, payments, direct costs, gross profit, margin and customer balance.",
      inputSchema: { job_ref: z.string().trim().min(1).max(50) },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_job_financials", input, context)
  );

  server.registerTool(
    "get_sales_summary",
    {
      title: "Get sales summary",
      description: "Summarise actual issued invoices, output VAT, credit notes, adjusted sales, payments and outstanding balances for an inclusive date range; optionally group the results.",
      inputSchema: { start_date: dateField("Start date"), end_date: dateField("End date"), group_by: z.enum(["day", "week", "month", "customer", "job"]).optional() },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_sales_summary", input, context)
  );

  server.registerTool(
    "get_vat_summary",
    {
      title: "Get VAT summary",
      description: "Report stored output VAT on sales, credit-note reversals, and recoverable input VAT on supplier bills and expenses for an inclusive tax-point period. Reporting only; this does not submit a VAT return.",
      inputSchema: { start_date: dateField("Start date"), end_date: dateField("End date") },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_vat_summary", input, context)
  );

  server.registerTool(
    "get_outstanding_debtors",
    {
      title: "Get outstanding customer debtors",
      description: "Show customers who owe money, their unpaid invoices, overall balances and Current, 1-30, 31-60, 61-90 and 90+ ageing buckets as at a date.",
      inputSchema: { as_of_date: dateField("As-of date").optional(), customer_name: z.string().optional(), minimum_outstanding: z.number().nonnegative().optional() },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_outstanding_debtors", input, context)
  );

  server.registerTool(
    "get_outstanding_creditors",
    {
      title: "Get outstanding supplier creditors",
      description: "Show supplier liabilities, unpaid bills, overall balances and Current, 1-30, 31-60, 61-90 and 90+ ageing buckets as at a date.",
      inputSchema: { as_of_date: dateField("As-of date").optional(), supplier_name: z.string().optional(), minimum_outstanding: z.number().nonnegative().optional() },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_outstanding_creditors", input, context)
  );

  server.registerTool(
    "get_profitability_report",
    {
      title: "Get job profitability report",
      description: "Report contract value, net invoiced revenue, payments, direct costs, gross profit and margin per job, plus aggregate totals. Results are not ranked unless the caller does so.",
      inputSchema: { start_date: dateField("Start date").optional(), end_date: dateField("End date").optional(), job_ref: z.string().optional(), customer_name: z.string().optional(), include_open_jobs: z.boolean().optional(), limit: financeLimit },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_profitability_report", input, context)
  );

  server.registerTool(
    "get_financial_summary",
    {
      title: "Get management financial summary",
      description: "Get high-level pipeline metrics separately from accounting metrics: invoiced sales, payments, debt, purchases, costs, gross profit, margin, input VAT and estimated VAT payable.",
      inputSchema: { start_date: dateField("Start date"), end_date: dateField("End date") },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_financial_summary", input, context)
  );

  server.registerTool(
    "get_accountant_pack",
    {
      title: "Prepare accountant pack",
      description: "Prepare structured JSON registers and summaries for sales, invoices, credit notes, payments, purchases, expenses, VAT, debtors, creditors and job profitability for an inclusive period.",
      inputSchema: { start_date: dateField("Start date"), end_date: dateField("End date") },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_accountant_pack", input, context)
  );

  server.registerTool(
    "get_subcontractors",
    {
      title: "Get subcontractor register",
      description: "List workspace subcontractors and their rates, CIS/VAT status, payment terms, insurance dates and masked bank-account details.",
      inputSchema: { name: z.string().trim().optional(), active_only: z.boolean().optional(), limit: financeLimit },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_subcontractors", input, context)
  );

  server.registerTool(
    "get_unmatched_transactions",
    {
      title: "Get bank transactions needing review",
      description: "List staged bank-statement transactions by review state. These rows have not changed the accounting ledger unless their state is Committed.",
      inputSchema: { import_ref: z.string().trim().optional(), review_status: z.enum(["Needs Review", "Approved", "Rejected", "Duplicate", "Committed"]).optional(), limit: financeLimit },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_unmatched_transactions", input, context)
  );

  server.registerTool(
    "get_bank_reconciliation_summary",
    {
      title: "Get bank reconciliation summary",
      description: "Summarise staged statement imports, money in, money out, committed rows, duplicates and transactions still requiring review.",
      inputSchema: { import_ref: z.string().trim().optional(), limit: financeLimit },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_bank_reconciliation_summary", input, context)
  );

  const vatCode = z.enum(["0", "5", "20", "exempt", "outside_scope"]).describe("Stored VAT treatment for this line; do not assume 20%.");
  const invoiceLine = z.object({ description: z.string().trim().min(1).max(500), quantity: z.number().positive().max(100000).default(1), unit: z.string().trim().max(50).optional(), unit_price: z.number().nonnegative().max(100000000), vat_code: vatCode, category: z.string().trim().max(100).optional(), job_cost_code: z.string().trim().max(100).optional() });
  const billLine = z.object({ description: z.string().trim().min(1).max(500), quantity: z.number().positive().max(100000).default(1), unit: z.string().trim().max(50).optional(), unit_cost: z.number().nonnegative().max(100000000), vat_code: vatCode, expense_category: z.string().trim().max(100).optional(), job_cost_code: z.string().trim().max(100).optional() });
  const confirmed = z.literal(true).describe("Must be true only after the user reviews and explicitly confirms this exact financial record.");
  const bankType = z.enum(["expense", "customer_payment", "supplier_payment", "transfer", "refund", "income", "ignore", "unmatched"]);
  const bankRow = z.object({ transaction_date: dateField("Transaction date"), description: z.string().trim().min(1).max(1000), amount: z.number().refine((value) => value !== 0, "Amount cannot be zero").describe("Signed bank amount: money in is positive and money out is negative."), reference: z.string().trim().max(300).optional(), balance: z.number().optional(), proposed_type: bankType.optional(), category: z.string().trim().max(100).optional(), supplier_name: z.string().trim().max(300).optional(), job_ref: z.string().trim().max(100).optional(), invoice_number: z.string().trim().max(100).optional(), bill_number: z.string().trim().max(100).optional() });
  const bankDecision = z.object({ transaction_ref: z.string().trim().min(1), action: z.enum(["approve", "reject", "duplicate"]), proposed_type: bankType.optional(), category: z.string().trim().max(100).optional(), vat_code: vatCode.optional(), net_amount: z.number().nonnegative().optional(), vat_amount: z.number().nonnegative().optional(), gross_amount: z.number().positive().optional(), supplier_name: z.string().trim().max(300).optional(), job_ref: z.string().trim().max(100).optional(), invoice_number: z.string().trim().max(100).optional(), bill_number: z.string().trim().max(100).optional(), reasoning: z.string().trim().max(2000).optional() });

  server.registerTool(
    "preview_bank_statement_import",
    {
      title: "Preview bank statement import",
      description: "Stage parsed CSV, spreadsheet or PDF bank transactions, suggest categories and flag possible duplicates. This is preview-only: it creates no expenses, payments, VAT entries or turnover.",
      inputSchema: { source_name: z.string().trim().min(1).max(200), original_filename: z.string().trim().max(500).optional(), account_name: z.string().trim().max(200).optional(), account_last_four: z.string().regex(/^\d{4}$/).optional(), period_start: dateField("Statement period start").optional(), period_end: dateField("Statement period end").optional(), notes: z.string().trim().max(5000).optional(), transactions: z.array(bankRow).min(1).max(500) },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("preview_bank_statement_import", input, context)
  );

  server.registerTool(
    "categorise_bank_transaction",
    {
      title: "Review bank transaction",
      description: "Approve, reject or mark one staged bank transaction as a duplicate. Expenses require reviewed category and VAT; payments require an exact invoice or supplier-bill match. Does not post the transaction yet.",
      inputSchema: { import_ref: z.string().trim().min(1), ...bankDecision.shape, confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("categorise_bank_transaction", input, context)
  );

  server.registerTool(
    "link_transaction_to_job",
    {
      title: "Link bank transaction to job",
      description: "Review and link a staged expense transaction to a visible roofing job reference before statement commit.",
      inputSchema: { import_ref: z.string().trim().min(1), transaction_ref: z.string().trim().min(1), job_ref: z.string().trim().min(1), proposed_type: z.literal("expense").default("expense"), category: z.string().trim().min(1), vat_code: vatCode, net_amount: z.number().nonnegative(), vat_amount: z.number().nonnegative(), gross_amount: z.number().positive(), supplier_name: z.string().trim().optional(), reasoning: z.string().trim().max(2000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("link_transaction_to_job", input, context)
  );

  server.registerTool(
    "match_customer_payment",
    {
      title: "Match bank receipt to customer invoice",
      description: "Review a money-in bank transaction and match it to an exact workspace invoice. The payment is not posted until the whole statement import is committed.",
      inputSchema: { import_ref: z.string().trim().min(1), transaction_ref: z.string().trim().min(1), invoice_number: z.string().trim().min(1), reasoning: z.string().trim().max(2000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("match_customer_payment", input, context)
  );

  server.registerTool(
    "reconcile_supplier_payment",
    {
      title: "Match bank payment to supplier bill",
      description: "Review a money-out bank transaction and match it to an exact supplier bill. The payment is not posted until the whole statement import is committed.",
      inputSchema: { import_ref: z.string().trim().min(1), transaction_ref: z.string().trim().min(1), bill_number: z.string().trim().min(1), reasoning: z.string().trim().max(2000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("reconcile_supplier_payment", input, context)
  );

  server.registerTool(
    "commit_bank_statement_import",
    {
      title: "Commit reviewed bank statement",
      description: "Atomically post a fully reviewed statement import to expenses and matched customer/supplier payments. Refuses unresolved rows, duplicates, overpayments and cross-workspace matches. Requires explicit confirmation.",
      inputSchema: { import_ref: z.string().trim().min(1), decisions: z.array(bankDecision).max(500).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("commit_bank_statement_import", input, context)
  );

  server.registerTool(
    "save_subcontractor",
    {
      title: "Add or update subcontractor",
      description: "Add a subcontractor to the workspace register, or update an existing subcontractor by name, including UTR, CIS, VAT, rates, payment and insurance details. Requires explicit confirmation.",
      inputSchema: { subcontractor_name: z.string().trim().min(1), existing_name: z.string().trim().optional(), company_name: z.string().trim().optional(), primary_role: z.string().trim().optional(), phone: z.string().trim().optional(), email: z.string().email().optional(), day_rate_cost: z.number().nonnegative().optional(), hourly_rate_cost: z.number().nonnegative().optional(), utr_number: z.string().trim().optional(), cis_status: z.enum(["gross", "net_20", "net_30", "not_registered"]), vat_registered: z.boolean(), vat_number: z.string().trim().optional(), payment_terms_days: z.number().int().min(0).max(365).optional(), bank_account_name: z.string().trim().optional(), bank_sort_code: z.string().trim().optional(), bank_account_number: z.string().trim().optional(), public_liability_expiry: dateField("Public liability expiry").optional(), employers_liability_expiry: dateField("Employers liability expiry").optional(), verification_notes: z.string().trim().max(5000).optional(), notes: z.string().trim().max(5000).optional(), is_active: z.boolean().optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("save_subcontractor", input, context)
  );

  server.registerTool(
    "record_subcontractor_cost",
    {
      title: "Record subcontractor cost",
      description: "Record approved subcontractor work against a roofing job, calculating line VAT, CIS deduction, payable amount and due date. Requires explicit confirmation.",
      inputSchema: { subcontractor_name: z.string().trim().min(1), job_ref: z.string().trim().min(1), work_date: dateField("Work date"), period_end_date: dateField("Period end date").optional(), invoice_reference: z.string().trim().optional(), description: z.string().trim().min(1).max(500), quantity: z.number().positive().default(1), unit: z.enum(["hour", "day", "item", "fixed"]).default("day"), unit_rate: z.number().nonnegative(), vat_rate: z.union([z.literal(0), z.literal(5), z.literal(20)]).optional(), cis_rate: z.union([z.literal(0), z.literal(20), z.literal(30)]).optional(), due_date: dateField("Due date").optional(), notes: z.string().trim().max(5000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("record_subcontractor_cost", input, context)
  );

  server.registerTool(
    "record_subcontractor_payment",
    {
      title: "Record subcontractor payment",
      description: "Record a confirmed full or part payment against a visible subcontractor cost reference. Rejects overpayments and cross-workspace references.",
      inputSchema: { cost_reference: z.string().trim().min(1), amount: z.number().positive(), payment_date: dateField("Payment date"), payment_method: z.enum(["Bank Transfer", "Card", "Cash", "Cheque", "Other"]), reference: z.string().trim().max(300).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("record_subcontractor_payment", input, context)
  );

  server.registerTool(
    "create_invoice",
    {
      title: "Create customer invoice",
      description: "Create a draft or issued customer invoice linked to a workspace-owned job. Can link the invoice to approved additional work using its visible reference, keeping its remaining balance and status accurate. Calculates net, line VAT and gross values from reviewed line items. Requires explicit confirmation.",
      inputSchema: { job_ref: z.string().trim().min(1), additional_work_ref: z.string().trim().min(1).optional().describe("Visible approved additional-work reference, for example WR-J-1005-V01."), invoice_number: z.string().trim().min(1).optional(), invoice_date: dateField("Invoice date"), tax_point_date: dateField("Tax point date").optional(), due_date: dateField("Due date"), status: z.enum(["Draft", "Sent"]).optional(), lines: z.array(invoiceLine).min(1).max(100), payment_terms: z.string().trim().max(1000).optional(), notes: z.string().trim().max(5000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("create_invoice", input, context)
  );

  server.registerTool(
    "record_customer_payment",
    {
      title: "Record customer payment",
      description: "Atomically record a confirmed full or part payment against an issued invoice. Rejects overpayments and cross-workspace references.",
      inputSchema: { invoice_number: z.string().trim().min(1), amount: z.number().positive().max(100000000), payment_date: dateField("Payment date"), payment_method: z.enum(["Bank Transfer", "Card", "Cash", "Cheque", "Finance", "Other"]), reference: z.string().trim().max(300).optional(), notes: z.string().trim().max(2000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("record_customer_payment", input, context)
  );

  server.registerTool(
    "create_supplier_bill",
    {
      title: "Create supplier bill",
      description: "Create a received supplier bill for an existing workspace supplier, optionally linked to a job, with line-level VAT and cost categories. Requires explicit confirmation.",
      inputSchema: { supplier_name: z.string().trim().min(1), job_ref: z.string().trim().optional(), bill_number: z.string().trim().optional(), supplier_reference: z.string().trim().max(300).optional(), bill_date: dateField("Bill date"), tax_point_date: dateField("Tax point date").optional(), due_date: dateField("Due date").optional(), expense_category: z.string().trim().max(100).optional(), lines: z.array(billLine).min(1).max(100), notes: z.string().trim().max(5000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("create_supplier_bill", input, context)
  );

  server.registerTool(
    "record_supplier_payment",
    {
      title: "Record supplier payment",
      description: "Atomically record a confirmed full or part payment against a supplier bill. Rejects overpayments and cross-workspace references.",
      inputSchema: { bill_number: z.string().trim().min(1), amount: z.number().positive().max(100000000), payment_date: dateField("Payment date"), payment_method: z.enum(["Bank Transfer", "Card", "Cash", "Cheque", "Finance", "Other"]), reference: z.string().trim().max(300).optional(), notes: z.string().trim().max(2000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("record_supplier_payment", input, context)
  );

  server.registerTool(
    "create_expense",
    {
      title: "Create business expense",
      description: "Record a confirmed miscellaneous business expense, optionally linked to a job and existing supplier, with an explicit VAT treatment.",
      inputSchema: { expense_date: dateField("Expense date"), description: z.string().trim().min(1).max(500), category: z.string().trim().min(1).max(100), net_amount: z.number().nonnegative().max(100000000), vat_code: vatCode, vat_amount: z.number().nonnegative().max(100000000).optional(), job_ref: z.string().trim().optional(), supplier_name: z.string().trim().optional(), payment_method: z.string().trim().max(100).optional(), reference: z.string().trim().max(300).optional(), receipt_url: z.string().url().max(2000).optional(), notes: z.string().trim().max(5000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("create_expense", input, context)
  );

  server.registerTool(
    "create_credit_note",
    {
      title: "Create customer credit note",
      description: "Create an issued credit note against a workspace-owned invoice with line-level VAT reversal. The credit cannot exceed the original invoice and requires explicit confirmation.",
      inputSchema: { invoice_number: z.string().trim().min(1), credit_note_number: z.string().trim().optional(), credit_note_date: dateField("Credit-note date"), tax_point_date: dateField("Tax point date").optional(), reason: z.string().trim().min(1).max(2000), lines: z.array(invoiceLine).min(1).max(100), notes: z.string().trim().max(5000).optional(), confirmed },
      annotations: FINANCIAL_WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("create_credit_note", input, context)
  );

  const surveyEvidence = z.object({
    field_path: z.string().trim().min(1).describe("Exact path, for example modules.pitched_roof.tile_type or global.problem_observed."),
    source_page: z.number().int().positive().optional(),
    source_excerpt: z.string().trim().max(1000).optional(),
    evidence_class: z.enum(["CONFIRMED", "SURVEYOR_STATED", "MEASURED", "APPROXIMATE", "INFERRED", "UNKNOWN"]),
    confidence: z.number().min(0).max(1).optional()
  });
  const surveyUpdateFields = {
    job_ref: z.string().trim().min(1).max(50),
    primary_survey_type: z.enum(["Pitched / Tiled", "Flat Roof", "Fascias / Soffits / Gutters", "Chimney / Lead", "Other / Misc"]).optional(),
    roof_type: z.enum(["Flat", "Pitched", "Slate", "Tile", "Fascia", "Chimney", "Mixed", "Other"]).optional(),
    enabled_modules: z.array(z.enum(["pitched_roof", "flat_roof", "fascias", "chimney", "other"])).max(5).optional(),
    global_fields: z.record(z.string(), z.unknown()).optional().describe("Only current keys returned by get_survey_schema. Unsupported facts must be omitted."),
    modules: z.record(z.string(), z.record(z.string(), z.unknown())).optional().describe("Structured values grouped by module key. Use exact field keys from get_survey_schema."),
    evidence: z.array(surveyEvidence).max(250).optional(),
    approved_conflicts: z.array(z.string()).max(250).optional().describe("Exact conflicting paths the user explicitly chose to replace."),
    approved_uncertain: z.array(z.string()).max(250).optional().describe("Exact inferred/low-confidence paths the user explicitly chose to save."),
    source_document_id: z.string().uuid().optional(),
    source_type: z.enum(["roof_report", "job_document", "video", "photo", "chatgpt_import", "other"]).optional(),
    import_summary: z.string().trim().max(2000).optional()
  };

  server.registerTool(
    "get_survey_schema",
    {
      title: "Get structured survey schema",
      description: "Load the current global survey fields, specialist module fields, types, units and exact allowed enum values. Call this before mapping a roof report; never guess field names or values.",
      inputSchema: { job_ref: z.string().trim().min(1).max(50).optional(), module_types: z.array(z.string().trim()).max(5).optional() },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_survey_schema", input, context)
  );

  server.registerTool(
    "get_job_survey",
    {
      title: "Get a job's structured survey",
      description: "Get the current global survey values, active specialist modules, module values, concurrency timestamp and field-level source evidence for one workspace-owned job.",
      inputSchema: { job_ref: z.string().trim().min(1).max(50) },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("get_job_survey", input, context)
  );

  server.registerTool(
    "preview_survey_update",
    {
      title: "Preview structured survey changes",
      description: "Validate a report-to-survey mapping without saving anything. Shows fields to apply, manual conflicts, uncertain or unsupported values, active modules, blank fields, an optimistic concurrency timestamp and an exact update hash.",
      inputSchema: surveyUpdateFields,
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("preview_survey_update", input, context)
  );

  server.registerTool(
    "preview_survey_from_document",
    {
      title: "Preview survey from a roof report",
      description: "Read an existing private PDF or image in a job's Documents area, map supported evidence into the current structured survey schema, and return conflicts, unknowns and an exact no-write preview. Use list_job_documents first. Nothing is saved.",
      inputSchema: {
        job_ref: z.string().trim().min(1).max(50),
        document_id: z.string().uuid().describe("Exact private job document ID returned by list_job_documents.")
      },
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("preview_survey_from_document", input, context)
  );

  server.registerTool(
    "update_survey",
    {
      title: "Apply reviewed structured survey changes",
      description: "Apply only the exact report-derived structured survey changes previously previewed. Preserves unapproved manual conflicts, requires optimistic concurrency and stores field-level source evidence. This does not put the report into internal notes.",
      inputSchema: { ...surveyUpdateFields, expected_updated_at: z.string().datetime({ offset: true }).nullable(), update_hash: z.string().length(64), confirmed: z.literal(true) },
      annotations: WRITE_ANNOTATIONS,
      _meta: OAUTH_TOOL_META
    },
    async (input) => runTool("update_survey", input, context)
  );

  return server;
}
