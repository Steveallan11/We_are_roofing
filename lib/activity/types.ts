export type ActivityActorType = "user" | "customer" | "system" | "gauge";

export type ActivityType =
  | "job_created"
  | "job_edited"
  | "status_changed"
  | "survey_booked"
  | "survey_saved"
  | "survey_edited"
  | "photos_uploaded"
  | "takeoff_saved"
  | "drawing_generated"
  | "drawing_attached"
  | "quote_generated"
  | "quote_edited"
  | "quote_approved"
  | "quote_sent"
  | "quote_accepted"
  | "quote_declined"
  | "email_sent"
  | "email_failed"
  | "sms_sent"
  | "customer_message"
  | "customer_replied"
  | "calendar_booked"
  | "job_rescheduled"
  | "materials_updated"
  | "invoice_created"
  | "invoice_sent"
  | "payment_received"
  | "job_completed"
  | "note_added";

export type ActivityRecord = {
  id: string;
  business_id: string | null;
  job_id: string | null;
  customer_id: string | null;
  quote_id: string | null;
  invoice_id: string | null;

  activity_type: ActivityType;
  message: string;
  details: Record<string, unknown>;

  actor_type: ActivityActorType;
  actor_id: string | null;
  actor_name: string | null;

  linked_entity_type: string | null;
  linked_entity_id: string | null;

  created_at: string;
};

export type ActivityInsert = {
  business_id?: string | null;
  job_id?: string | null;
  customer_id?: string | null;
  quote_id?: string | null;
  invoice_id?: string | null;

  activity_type: ActivityType;
  message: string;
  details?: Record<string, unknown>;

  actor_type?: ActivityActorType;
  actor_id?: string | null;
  actor_name?: string | null;

  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
};
