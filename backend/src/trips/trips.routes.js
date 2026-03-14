/**
 * Trips routes — GET/POST trip endpoints + activity block creation.
 */
import { Router } from "express";
import { getUserTrips, getTripById, createTrip } from "./trips.service.js";
import { getBlocksForTrip, createActivityBlock, patchBlockResolution } from "./activities.service.js";

const router = Router();

// ─── GET /trips ───
router.get("/", async (req, res) => {
  try {
    const trips = await getUserTrips(req.user);
    res.json({ trips });
  } catch (err) {
    console.error("GET /trips error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /trips/:id ───
router.get("/:id", async (req, res) => {
  try {
    const trip = await getTripById(req.user, req.params.id);
    const blocks = await getBlocksForTrip(req.user, req.params.id);
    res.json({ trip, activity_blocks: blocks });
  } catch (err) {
    console.error("GET /trips/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /trips ───
router.post("/", async (req, res) => {
  const { destination, start_date, end_date } = req.body || {};
  if (!destination || !start_date || !end_date) {
    return res.status(400).json({ error: "destination, start_date, and end_date are required" });
  }
  try {
    const trip = await createTrip(req.user, req.body);
    res.status(201).json({ trip });
  } catch (err) {
    console.error("POST /trips error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /trips/:id/blocks ───
router.post("/:id/blocks", async (req, res) => {
  const { place_name, day_index, start_time, end_time } = req.body || {};
  if (!place_name || day_index == null || !start_time || !end_time) {
    return res.status(400).json({
      error: "place_name, day_index, start_time, and end_time are required",
    });
  }

  try {
    // Fetch trip to get destination for Gemini place resolver
    const trip = await getTripById(req.user, req.params.id);
    const block = await createActivityBlock(req.user, { ...req.body, trip_id: req.params.id }, trip);
    res.status(201).json({ activity_block: block });
  } catch (err) {
    console.error("POST /trips/:id/blocks error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /trips/:id/blocks/:blockId ───
// Used by Task 3 to update resolved place data after Google Places lookup
router.patch("/:id/blocks/:blockId", async (req, res) => {
  try {
    const updated = await patchBlockResolution(req.user, req.params.blockId, req.body);
    res.json({ activity_block: updated });
  } catch (err) {
    console.error("PATCH block error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
