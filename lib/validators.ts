import { z } from "zod";

export const createJobSchema = z.object({
  customer: z
    .object({
      customer_id: z.string().uuid().optional().or(z.literal("")),
      customer_type: z.enum(["person", "business"]).default("person"),
      full_name: z.string().optional().default(""),
      business_name: z.string().optional().default(""),
      phone: z.string().min(1),
      email: z.string().email().optional().or(z.literal("")),
      contact_person_name: z.string().optional().default(""),
      contact_person_phone: z.string().optional().default(""),
      contact_person_email: z.string().email().optional().or(z.literal("")),
      property_address: z.string().min(1),
      postcode: z.string().optional(),
      town: z.string().optional(),
      county: z.string().optional(),
      source: z.string().optional()
    })
    .superRefine((customer, ctx) => {
      if (customer.customer_type === "person" && !customer.full_name.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["full_name"],
          message: "Customer name is required."
        });
      }

      if (customer.customer_type === "business" && !customer.business_name.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["business_name"],
          message: "Business name is required."
        });
      }

      if (customer.customer_type === "business" && !customer.contact_person_name.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contact_person_name"],
          message: "Contact person is required for business customers."
        });
      }
    }),
  job: z.object({
    job_title: z.string().min(1),
    job_type: z.string().min(1),
    roof_type: z.string().min(1),
    urgency: z.string().optional(),
    internal_notes: z.string().optional()
  })
});

export const createCustomerSchema = z
  .object({
    customer_type: z.enum(["person", "business"]).default("person"),
    full_name: z.string().optional().default(""),
    business_name: z.string().optional().default(""),
    phone: z.string().min(1),
    email: z.string().email().optional().or(z.literal("")),
    contact_person_name: z.string().optional().default(""),
    contact_person_phone: z.string().optional().default(""),
    contact_person_email: z.string().email().optional().or(z.literal("")),
    address_line_1: z.string().optional().default(""),
    postcode: z.string().optional().default(""),
    town: z.string().optional().default(""),
    county: z.string().optional().default(""),
    notes: z.string().optional().default("")
  })
  .superRefine((customer, ctx) => {
    if (customer.customer_type === "person" && !customer.full_name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["full_name"],
        message: "Customer name is required."
      });
    }

    if (customer.customer_type === "business" && !customer.business_name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["business_name"],
        message: "Business name is required."
      });
    }

    if (customer.customer_type === "business" && !customer.contact_person_name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact_person_name"],
        message: "Contact person is required for business customers."
      });
    }
  });

export const surveySchema = z.object({
  surveyor_name: z.string().min(1),
  access_notes: z.string().default(""),
  scaffold_required: z.boolean().default(false),
  scaffold_notes: z.string().default(""),
  roof_condition: z.string().default(""),
  problem_observed: z.string().min(1),
  suspected_cause: z.string().default(""),
  recommended_works: z.string().min(1),
  measurements: z.string().default(""),
  weather_notes: z.string().default(""),
  safety_notes: z.string().default(""),
  customer_concerns: z.string().default(""),
  voice_note_transcript: z.string().default(""),
  raw_notes: z.string().default(""),
  survey_type: z.string().min(1),
  roof_type: z.string().min(1),
  no_photo_confirmation: z.boolean().default(false),
  adaptive_sections: z.record(z.string(), z.unknown()).default({})
});

export const photoMetadataSchema = z.object({
  photo_type: z.string().min(1),
  caption: z.string().optional(),
  file_name: z.string().min(1)
});
