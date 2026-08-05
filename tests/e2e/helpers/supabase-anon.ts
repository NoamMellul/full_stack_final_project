import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Deliberately unauthenticated — reads through this client are subject to
// the public branch of the doctors RLS policy
// (doctors_select_active_or_owner_or_admin), never bypassed by service-role.
export function testAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
