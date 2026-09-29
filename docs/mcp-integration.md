# ChatGPT MCP integration

The application exposes a stateless Streamable HTTP MCP endpoint at `POST /mcp`.

## Current scope

The integration exposes these read tools:

- `get_jobs`
- `get_job_detail`
- `search_customers`
- `get_customer_jobs`
- `get_quotes`
- `get_pipeline_summary`
- `get_overdue_items`

It also exposes these guarded write tools:

- `create_job`
- `move_job_pipeline`
- `append_job_note`
- `set_job_followup`
- `archive_job`
- `draft_customer_email`
- `send_customer_email_draft`

The read tool `list_literature` lets ChatGPT discover valid attachment names before
drafting an email.

Every tool is annotated with its actual read-only, destructive, idempotent, and
open-world behaviour. `archive_job` is marked destructive and requires
`confirmed: true` after explicit user confirmation. It archives rather than
deletes the job. `send_customer_email_draft` can only send a persisted draft and
requires `confirmed: true` after the exact recipient, subject, body, and
attachments have been reviewed. Deletion, note replacement, and direct
unreviewed sending are not exposed.

## Authentication

Requests must include either the private MCP bearer token or a Supabase user
access token:

```http
Authorization: Bearer <access-token>
```

For the private owner connection, the endpoint compares the token against the
server-only `MCP_BEARER_TOKEN` using a timing-safe comparison. This is suitable
for a private Codex/ChatGPT desktop connection that supports static bearer
credentials.

For interactive user access, Supabase Auth acts as the OAuth 2.1 authorization
server. ChatGPT discovers it through `/.well-known/oauth-protected-resource`,
registers dynamically, and uses the authorization-code flow with PKCE. The
consent screen lives at `/oauth/consent` and makes the requested identity scopes
and business read/write access explicit.

The endpoint validates the resulting Supabase access token on every request.
Access is then restricted to the email configured in
`MVP_ADMIN_EMAIL` (falling back to `NEXT_PUBLIC_MVP_ADMIN_EMAIL`). If neither
value is configured, Supabase-token access is denied.

The Supabase service-role key is never accepted from the MCP client and must
remain server-only.

## Connecting ChatGPT

1. In ChatGPT developer mode, add
   `https://we-are-roofing-roofiq.vercel.app/mcp` as a custom app.
2. Complete the Supabase login and approve the access request with the configured
   administrator account.
3. Refresh the app so ChatGPT scans all fifteen tool descriptors.
4. Test read tools first, then test each write tool against a non-critical job.

Supabase OAuth Server and dynamic client registration must remain enabled. Its
Site URL must remain the production application origin so authorization requests
return to `/oauth/consent`.

## Communication safety

Drafting and sending are separate operations. Sending is annotated as destructive
and open-world because it contacts an external recipient. The server also rejects
an unconfirmed send, refuses to resend a completed draft, and resolves the saved
recipient and attachments from the database rather than accepting them again at
send time. Deletion remains unavailable through MCP.
