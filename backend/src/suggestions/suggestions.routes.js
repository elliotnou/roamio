/**
 * Suggestions routes placeholder.
 *
 * What this file should do:
 * 1. Define POST /suggestions endpoint.
 * 2. Only run suggestions flow when energy_level is less than or equal to 6.
 * 3. Request structured intent from Gemini service.
 * 4. Resolve real nearby options via places service and return card payloads.
 */
export class SuggestionsRoutesPlaceholder {}
import { Router } from "express";
import { buildIntentFromContext } from "./gemini.service.js";
import { findWellnessPlaces } from "./places.service.js";

const router = Router();

router.post("/", async (req, res) => {
  const energyLevel = Number(req.body?.energy_level || 0);
  if (energyLevel > 6) {
    return res.json({ suggestions: [], message: "Energy is high; no reroute needed." });
  }

  const intent = await buildIntentFromContext(req.user.id, req.body);
  const suggestions = await findWellnessPlaces(intent, req.body.current_lat, req.body.current_lng);
  return res.json({ intent, suggestions });
});

export default router;
