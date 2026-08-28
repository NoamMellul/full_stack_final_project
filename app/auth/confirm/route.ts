import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Bridges a Supabase Auth recovery token into a real session ahead of
// /reset-password. Exists because @supabase/ssr's browser client hardcodes
// flowType: "pkce" (lib/supabase/client.ts, verified) — a PKCE-only client
// actively REJECTS (AuthPKCEGrantCodeExchangeError) the legacy implicit
// `#access_token=` hash that Supabase's own hosted `/auth/v1/verify`
// endpoint issues for any recovery token with no associated PKCE code
// challenge, which includes every link produced by
// supabase.auth.admin.generateLink() (used by
// tests/e2e/helpers/test-users.ts's generateRecoveryLink) and is also the
// documented Supabase pattern for a PKCE app's own email templates
// (linking via `{{ .TokenHash }}` rather than `{{ .ConfirmationURL }}`).
// verifyOtp() authenticates directly off the raw token_hash, sidestepping
// the whole implicit-vs-PKCE redirect-shape question, and persists the
// resulting session via the SAME cookie-bound SSR client every other route
// in this app uses — which is exactly why the existing, unmodified
// POST /api/auth/change-password can see it afterward.
//
// Single-purpose: this app only issues recovery links, so `type` is
// required to be the literal "recovery" and nothing else is accepted.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    // Deliberately unbranched: a failed verification simply leaves no
    // session cookie set, and /reset-password's own getSession() check
    // renders the invalid-link state correctly either way.
    await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  }

  // Hardcoded destination — never a request-controlled `next` param
  // (T-EUO-03) — this route exists solely to establish a session ahead of
  // the one page that consumes it.
  return NextResponse.redirect(new URL("/reset-password", request.url));
}
