/**
 * Authentication middleware.
 *
 * Verifies the Bearer token from the Authorization header using Supabase
 * and attaches the authenticated user to `req.user`.
 */
import { supabase } from "../config/supabase.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Attach user info and raw token for downstream use
    req.user = {
      id: data.user.id,
      email: data.user.email,
      token,
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Authentication service error" });
  }
}
