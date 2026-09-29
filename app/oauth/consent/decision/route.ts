import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const authorizationId = formData.get("authorization_id");
  const decision = formData.get("decision");

  if (typeof authorizationId !== "string" || !authorizationId || (decision !== "approve" && decision !== "deny")) {
    return NextResponse.json({ error: "Invalid authorization decision." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const allowedEmail = (process.env.MVP_ADMIN_EMAIL || process.env.NEXT_PUBLIC_MVP_ADMIN_EMAIL)
    ?.trim()
    .toLowerCase();

  if (!user || !allowedEmail || user.email?.toLowerCase() !== allowedEmail) {
    return NextResponse.json({ error: "This account is not authorised." }, { status: 403 });
  }

  const result =
    decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });

  if (result.error || !result.data?.redirect_url) {
    return NextResponse.json({ error: result.error?.message || "Authorization could not be completed." }, { status: 400 });
  }

  return NextResponse.redirect(result.data.redirect_url, 303);
}
