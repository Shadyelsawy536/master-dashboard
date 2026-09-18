import { createClient } from '@supabase/supabase-js';

// Same Supabase project as everything else (cafe-website, Cafe-App,
// cafe-admin-dashboard). The anon key grants nothing by itself here either
// -- private.is_platform_admin() in RLS (checked against the platform_users
// table) is what actually gates every platform-level table and RPC this
// dashboard touches. Unlike cafe-admin-dashboard, this app has no single
// RESTAURANT_ID constant -- a platform admin's whole point is seeing across
// every tenant.
const SUPABASE_URL = 'https://rsajmvnbezztzdkbglbp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzYWptdm5iZXp6dHpka2JnbGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDA1MzcsImV4cCI6MjEwMjAxNjUzN30.pqOBqWwmbedn1CR-y0ZAFDHa3GZIWUKwqFmnyx0f4Os';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
