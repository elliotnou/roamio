/**
 * Supabase client configuration.
 *
 * Creates a service-role Supabase client for backend use and a helper
 * that builds a per-request client scoped to the caller's JWT.
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing required env vars: SUPABASE_URL and SUPABASE_ANON_KEY must be set."
  );
}

/**
 * Admin-level client (service role). Use for operations that bypass RLS,
 * e.g. looking up a user by token. Only available when SUPABASE_SERVICE_ROLE_KEY is set.
 */
export const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Anon-level client shared across requests (RLS enforced).
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Build a Supabase client that carries the caller's access token,
 * so RLS policies see the caller's `auth.uid()`.
 */
export function supabaseForUser(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
