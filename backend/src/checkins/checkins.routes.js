/**
 * Check-ins routes placeholder.
 *
 * What this file should do:
 * 1. Define POST /checkins endpoint.
 * 2. Validate activity_block_id, energy_level, and current coordinates.
 * 3. Persist check-in event via checkins service.
 * 4. Return updated battery curve computed from battery service.
 */
export class CheckinsRoutesPlaceholder {}
import { Router } from "express";
import { createCheckIn } from "./checkins.service.js";
import { buildBatteryCurve } from "./battery.service.js";

const router = Router();

router.post("/", async (req, res) => {
  const checkIn = await createCheckIn(req.user.id, req.body);
  const batteryCurve = await buildBatteryCurve(req.user.id, req.body.activity_block_id, req.body.energy_level);
  res.status(201).json({ checkIn, batteryCurve });
});

export default router;
