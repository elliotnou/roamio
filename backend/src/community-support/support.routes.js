/**
 * Community support routes.
 *
 * Separate from itinerary rerouting flow.
 */
import { Router } from "express";
import {
  getCommunitySupportCategories,
  findCommunitySupportPlaces,
} from "./support.service.js";

const router = Router();

router.get("/categories", (_req, res) => {
  const categories = getCommunitySupportCategories();
  res.json({ categories });
});

router.post("/find", async (req, res) => {
  const {
    need_category,
    current_lat,
    current_lng,
    radius_meters,
  } = req.body || {};

  if (!need_category || current_lat == null || current_lng == null) {
    return res.status(400).json({
      error: "need_category, current_lat, and current_lng are required",
    });
  }

  try {
    const payload = await findCommunitySupportPlaces({
      need_category,
      current_lat,
      current_lng,
      radius_meters,
    });
    return res.json(payload);
  } catch (err) {
    console.error("POST /community-support/find error:", err);
    return res.status(400).json({ error: err.message || "Failed to find community support places" });
  }
});

export default router;
