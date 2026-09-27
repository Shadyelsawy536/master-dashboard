// verify-domain: checks a real DNS TXT record to confirm the caller
// actually controls the domain they're trying to attach to their
// restaurant, before we ever consider routing traffic for it. Prevents
// someone from claiming a domain they don't own just by typing it into a
// form.

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

    const { domainId } = await req.json();
    if (!domainId) return json({ error: "domainId is required" }, 400);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // RLS on custom_domains already restricts this to platform admins or
    // staff with settings.manage for that restaurant -- if the row comes
    // back null, the caller either isn't allowed to see it or it doesn't
    // exist, and either way the answer is the same generic 404.
    const { data: domainRow, error: fetchError } = await callerClient
      .from("custom_domains")
      .select("id, domain, verification_token, restaurant_id")
      .eq("id", domainId)
      .maybeSingle();

    if (fetchError || !domainRow) return json({ error: "Domain not found" }, 404);

    // Dedicated subdomain prefix so this never collides with a domain's
    // existing TXT records (SPF, DKIM, etc). Rename the prefix once a real
    // platform domain/brand is picked -- it's not load-bearing anywhere
    // else.
    const lookupHost = `_platform-verify.${domainRow.domain}`;
    const dohResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(lookupHost)}&type=TXT`,
      { headers: { Accept: "application/dns-json" } },
    );

    if (!dohResponse.ok) {
      return json({ verified: false, error: "DNS lookup failed -- try again shortly" }, 502);
    }

    const dohBody = await dohResponse.json();
    const txtValues: string[] = (dohBody.Answer ?? []).map((a: { data: string }) => a.data.replace(/"/g, ""));
    const matched = txtValues.includes(domainRow.verification_token);

    if (!matched) {
      return json({
        verified: false,
        expectedRecord: { host: lookupHost, type: "TXT", value: domainRow.verification_token },
        found: txtValues,
      });
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await adminClient.from("custom_domains").update({ verified: true, verified_at: new Date().toISOString() }).eq(
      "id",
      domainId,
    );

    return json({ verified: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
