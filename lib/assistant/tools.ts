import type { AssistantToolDefinition } from "@/lib/assistant/types";

export const ASSISTANT_TOOLS: AssistantToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_jobs",
      description: "Get a list of jobs, optionally filtered by status, customer name, or overdue follow-up.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          customer_name: { type: "string" },
          limit: { type: "number" },
          overdue_followup: { type: "boolean" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_job_detail",
      description: "Get full details of a specific job including customer info, survey, quote, and materials.",
      parameters: {
        type: "object",
        properties: {
          job_ref: { type: "string" },
          job_id: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_job",
      description: "Create a new job and create the customer as well if needed.",
      parameters: {
        type: "object",
        required: ["job_title", "property_address", "customer_name"],
        properties: {
          job_title: { type: "string" },
          property_address: { type: "string" },
          postcode: { type: "string" },
          customer_name: { type: "string" },
          customer_phone: { type: "string" },
          customer_email: { type: "string" },
          job_type: { type: "string" },
          roof_type: { type: "string" },
          urgency: { type: "string" },
          source: { type: "string" },
          internal_notes: { type: "string" },
          estimated_value: { type: "number" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_job_status",
      description: "Update the status of a job.",
      parameters: {
        type: "object",
        required: ["job_ref", "new_status"],
        properties: {
          job_ref: { type: "string" },
          new_status: { type: "string" },
          internal_notes: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_job_notes",
      description: "Append or replace internal notes on a job.",
      parameters: {
        type: "object",
        required: ["job_ref", "notes"],
        properties: {
          job_ref: { type: "string" },
          notes: { type: "string" },
          mode: { type: "string", enum: ["append", "replace"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_followup_date",
      description: "Set or update the follow-up date on a job.",
      parameters: {
        type: "object",
        required: ["job_ref", "follow_up_date"],
        properties: {
          job_ref: { type: "string" },
          follow_up_date: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_customers",
      description: "Search customers by name, phone, email, or postcode.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_customer_jobs",
      description: "Get all jobs for a customer.",
      parameters: {
        type: "object",
        required: ["customer_name"],
        properties: {
          customer_name: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_quotes",
      description: "Get quotes filtered by status or job ref.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          job_ref: { type: "string" },
          limit: { type: "number" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_quote_status",
      description: "Update the status of a quote.",
      parameters: {
        type: "object",
        required: ["quote_ref", "new_status"],
        properties: {
          quote_ref: { type: "string" },
          new_status: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_pipeline_summary",
      description: "Get a summary of the current jobs pipeline with counts and values by status.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_revenue_summary",
      description: "Get revenue summary for a time period.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["this_week", "this_month", "last_month", "this_year"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_overdue_items",
      description: "Get overdue follow-ups and quotes sent more than 7 days ago without progression.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: "Navigate the user to a specific page in the app.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Use real app paths: /crm, /jobs/new, /jobs/[jobId], /jobs/[jobId]/survey, /jobs/[jobId]/roof-survey, /jobs/[jobId]/quote, /knowledge." },
          job_ref: { type: "string", description: "If navigating to a job-specific page, provide the job ref so the handler can resolve the UUID." },
          destination: { type: "string", enum: ["jobs", "new_job", "job", "survey", "roof_survey", "quote", "knowledge", "dashboard"] }
        }
      }
    }
  }
];
