/**
 * Check-ins routes — POST /checkins, PATCH /checkins/:id/outcome, GET /checkins
 */
import { Router } from "express";
import { createCheckIn, updateCheckInOutcome, getAllCheckIns } from "./checkins.service.js";
import { buildBatteryCurve } from "./battery.service.js";

const router = Router();

// ─── POST /checkins ───
router.post("/", async (req, res) => {
  const { activity_block_id, energy_level, current_lat, current_lng } = req.body || {};

  if (!activity_block_id || energy_level == null || current_lat == null || current_lng == null) {
    return res.status(400).json({
      error: "activity_block_id, energy_level, current_lat, and current_lng are required",
    });
  }

  try {
    const checkIn = await createCheckIn(req.user, req.body);
    const batteryCurve = await buildBatteryCurve(req.user.id, activity_block_id, energy_level);
    res.status(201).json({ check_in: checkIn, battery_curve: batteryCurve });
  } catch (err) {
    console.error("POST /checkins error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /checkins/:id/outcome ───
// Called when user picks or dismisses a suggestion card
router.patch("/:id/outcome", async (req, res) => {
  const { agent_outcome } = req.body || {};
  if (!agent_outcome) {
    return res.status(400).json({ error: "agent_outcome is required" });
  }

  try {
    const updated = await updateCheckInOutcome(req.user, req.params.id, req.body);
    res.json({ check_in: updated });
  } catch (err) {
    console.error("PATCH /checkins/:id/outcome error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /checkins ───
router.get("/", async (req, res) => {
  try {
    const checkIns = await getAllCheckIns(req.user);
    res.json({ check_ins: checkIns });
  } catch (err) {
    console.error("GET /checkins error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
