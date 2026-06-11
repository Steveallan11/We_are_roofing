-- Editable nurture email templates
-- Stores customizable follow-up email templates keyed by day

create table if not exists public.nurture_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  day_number integer not null,
  template_name text not null,
  subject text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, day_number)
);

create index if not exists nurture_templates_business_day_idx
  on public.nurture_templates (business_id, day_number);

alter table public.nurture_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nurture_templates' and policyname = 'Authenticated admin access nurture_templates'
  ) then
    create policy "Authenticated admin access nurture_templates"
      on public.nurture_templates for all
      using (auth.role() = 'authenticated');
  end if;
end $$;

-- Insert default templates for all businesses
insert into public.nurture_templates (business_id, day_number, template_name, subject, body)
select
  b.id,
  days.day_number,
  days.template_name,
  days.subject,
  days.body
from public.businesses b
cross join (
  values
    (3, 'follow_up_3days', 'Checking in on your quote – Any questions?',
     'Hi {customer_name},

I hope you''ve had a chance to review the quote for {job_title}.

If you have any questions or need clarification on anything, I''m here to help. Just give me a call or reply to this email.

Looking forward to working with you!

Best regards,
Andy @ We Are Roofing'),
    (7, 'follow_up_7days', 'Following up on your {job_title} quote',
     'Hi {customer_name},

Following up on the quote we sent a few days ago for {job_title}.

Would love to get this moving forward. Let me know if you''d like to proceed or if there''s anything I can help clarify.

Thanks!
Andy'),
    (14, 'follow_up_14days', 'Last reminder: Your roof quote is still valid',
     'Hi {customer_name},

Just a friendly reminder that the quote for {job_title} is still valid and available.

If you''re ready to move forward or have any final questions, I''m happy to help. Otherwise, feel free to reach out if your timeline changes and you''d like to revisit the project.

Best regards,
Andy @ We Are Roofing')
) as days(day_number, template_name, subject, body)
on conflict (business_id, day_number) do nothing;
