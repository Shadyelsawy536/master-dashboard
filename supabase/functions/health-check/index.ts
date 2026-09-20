// health-check: deliberately does nothing but respond. The System Health
// page calls this and measures real round-trip latency client-side --
// proof the Edge Functions runtime is actually up right now, not a
// hardcoded green dot.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ ok: true, checkedAt: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
