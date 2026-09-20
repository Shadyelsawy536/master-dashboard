// create-restaurant: platform-admin-only. Creates a full tenant in one
// operation (restaurant + settings + branding + subscription + Owner role
// with all permissions via the create_restaurant_full RPC), then invites
// the admin's email and links them to the new restaurant as Owner. The
// invite step needs the Auth Admin API, which is why this can't be done
// as a single SQL RPC call from the browser.

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

    const { name, slug, planId, adminEmail, logoUrl, primaryColor, secondaryColor } = await req.json();
    if (!name || !slug || !planId || !adminEmail) {
      return json({ error: "name, slug, planId, and adminEmail are required" }, 400);
    }

    // Caller's own JWT -- respects RLS. is_platform_admin() is checked again
    // inside create_restaurant_full itself, so this isn't the only gate,
    // but failing fast here gives a clearer error than a generic RLS denial.
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData?.user) return json({ error: "Invalid session" }, 401);

    const { data: platformUserRow } = await callerClient
      .from("platform_users")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!platformUserRow) return json({ error: "Not a platform admin" }, 403);

    const { data: created, error: createError } = await callerClient.rpc("create_restaurant_full", {
      p_name: name,
      p_slug: slug,
      p_plan_id: planId,
      p_logo_url: logoUrl ?? null,
      p_primary_color: primaryColor ?? null,
      p_secondary_color: secondaryColor ?? null,
    });
    if (createError || !created) {
      return json({ error: createError?.message ?? "Could not create restaurant" }, 400);
    }

    const { restaurant_id: restaurantId, owner_role_id: ownerRoleId } = created as {
      restaurant_id: string;
      owner_role_id: string;
    };

    // Service-role client -- only used for the two steps that genuinely
    // need it: inviting a brand-new auth user, and linking them before
    // they've logged in once (so there's no session of theirs to act as).
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(adminEmail);
    if (inviteError || !invited?.user) {
      // The restaurant/subscription/role already exist and are usable --
      // only the admin link failed. Report that clearly instead of losing
      // the created restaurant, since there's no invite-retry UI yet.
      return json(
        {
          success: false,
          restaurantId,
          error: `Restaurant created, but couldn't invite ${adminEmail}: ${
            inviteError?.message ?? "unknown error"
          }. The restaurant exists with no admin yet -- retry the invite manually via Supabase Auth.`,
        },
        207,
      );
    }

    const { error: linkError } = await adminClient
      .from("restaurant_users")
      .insert({ restaurant_id: restaurantId, user_id: invited.user.id, role_id: ownerRoleId });

    if (linkError) {
      return json(
        {
          success: false,
          restaurantId,
          error: `Restaurant created and ${adminEmail} was invited, but couldn't link them as Owner: ${linkError.message}`,
        },
        207,
      );
    }

    return json({ success: true, restaurantId, ownerUserId: invited.user.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
