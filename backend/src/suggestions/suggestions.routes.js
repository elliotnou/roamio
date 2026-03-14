/**
 * Suggestions routes — POST /suggestions
 *
 * Orchestrates the full suggestion flow:
 * 1. If energy >= 7, return affirmation (no AI call needed)
 * 2. Run Gemini classifier to confirm rerouting decision
 * 3. If classifier says no reroute, return affirmation
 * 4. Fetch nearby candidates (Task 3 — currently placeholder)
 * 5. If candidates available, run Gemini ranker
 * 6. Return ranked suggestions
 */
import { Router } from "express";
import { classifyCheckIn, rankAlternatives } from "./gemini.service.js";
import { findNearbyPlaceCandidates } from "./places.service.js";
import { getCheckInsForTrip } from "../checkins/checkins.service.js";
import { getRemainingBlocksToday, getBlockById } from "../trips/activities.service.js";
import { getTripById } from "../trips/trips.service.js";

const router = Router();

router.post("/", async (req, res) => {
  const {
    activity_block_id,
    energy_level,
    trip_id,
    current_lat,
    current_lng,
    current_time,
    current_block,
  } = req.body || {};

  if (!activity_block_id || !trip_id || energy_level == null || current_lat == null || current_lng == null) {
    return res.status(400).json({
      error: "activity_block_id, trip_id, energy_level, current_lat, and current_lng are required",
    });
  }

  const energyLevel = Number(energy_level);

  // ─── Fast path: high energy ───
  if (energyLevel >= 7) {
    return res.json({
      needs_rerouting: false,
      energy_gap: 0,
      affirmation_message: "You're doing great! Keep enjoying your adventure 🌟",
      reasoning: "Energy is high — no reroute needed.",
      suggestions: [],
    });
  }

  try {
    // ─── Build classifier context ───
    let blockContext = current_block || null;
    let remainingBlocks = [];
    let priorCheckIns = [];
    let destination = req.body.destination || "";
    const now = current_time || new Date().toISOString();
    let resolvedTripId = trip_id;

    if (activity_block_id) {
      try {
        blockContext = await getBlockById(req.user, activity_block_id);
        resolvedTripId = blockContext.trip_id;
      } catch {
        // Keep going with request-provided context when block lookup fails.
      }
    }

    if (resolvedTripId) {
      try {
        const trip = await getTripById(req.user, resolvedTripId);
        destination = trip.destination || destination;
      } catch { /* ignore — destination not critical for classifier */ }

      try {
        remainingBlocks = await getRemainingBlocksToday(req.user, resolvedTripId, now);
      } catch { /* ignore */ }

      try {
        priorCheckIns = await getCheckInsForTrip(req.user, resolvedTripId);
      } catch { /* ignore */ }
    }

    // Ensure we have at least a minimal current_block shape for the prompt
    if (!blockContext) {
      blockContext = {
        place_name: "Current activity",
        start_time: now,
        end_time: now,
      };
    }

    // ─── Run Gemini classifier ───
    const classification = await classifyCheckIn({
      energyLevel,
      currentTime: now,
      currentBlock: blockContext,
      remainingBlocks,
      priorCheckIns,
    });

    if (!classification.needs_rerouting) {
      return res.json({
        ...classification,
        suggestions: [],
      });
    }

    // ─── Fetch nearby candidates (Task 3 placeholder) ───
    const candidates = await findNearbyPlaceCandidates(
      classification,
      current_lat,
      current_lng,
      destination,
      {
        current_activity_type: blockContext.activity_type || "other",
        current_place_id: blockContext.resolved_place_id || null,
        current_place_name: blockContext.place_name || "",
        current_resolved_place_name: blockContext.resolved_place_name || "",
      }
    );

    // ─── If candidates available, rank them ───
    let suggestions = [];
    if (candidates.length > 0) {
      const timeRemaining = blockContext.end_time
        ? Math.max(0, (new Date(blockContext.end_time).getTime() - Date.now()) / 60000)
        : 60;

      const ranked = await rankAlternatives({
        currentActivityType: blockContext.activity_type || "other",
        energyLevel,
        energyGap: classification.energy_gap,
        timeRemainingMinutes: Math.round(timeRemaining),
        destination,
        candidates,
      });
      suggestions = ranked.suggestions;
    }

    return res.json({
      ...classification,
      suggestions,
      _places_available: candidates.length > 0,
    });
  } catch (err) {
    console.error("POST /suggestions error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
