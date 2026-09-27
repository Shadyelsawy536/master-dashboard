// invite-platform-user: platform-admin-only. Invites someone by email and
// links them into platform_users with a chosen platform role. Mirrors
// cafe-admin-dashboard's invite-staff pattern, just one level up (platform
// staff, not restaurant staff).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const { email, platformRoleId } = await req.json();
    if (!email || !platformRoleId) return json({ error: "email and platformRoleId are required" }, 400);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData?.user) return json({ error: "Invalid session" }, 401);

    const { data: callerRow } = await callerClient
      .from("platform_users")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!callerRow) return json({ error: "Not a platform admin" }, 403);

    const { data: roleRow } = await callerClient.from("platform_roles").select("id").eq("id", platformRoleId)
      .maybeSingle();
    if (!roleRow) return json({ error: "Platform role not found" }, 400);

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited?.user) {
      return json({ error: `Couldn't invite ${email}: ${inviteError?.message ?? "unknown error"}` }, 400);
    }

    const { error: linkError } = await adminClient
      .from("platform_users")
      .insert({ user_id: invited.user.id, platform_role_id: platformRoleId });

    if (linkError) {
      return json(
        { error: `${email} was invited, but couldn't be linked as a platform user: ${linkError.message}` },
        207,
      );
    }

    return json({ success: true, userId: invited.user.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
