import "dotenv/config";
import express from "express";
import tripsRoutes from "./trips/trips.routes.js";
import checkinsRoutes from "./checkins/checkins.routes.js";
import suggestionsRoutes from "./suggestions/suggestions.routes.js";
import { requireAuth } from "./middleware/auth.middleware.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/trips", requireAuth, tripsRoutes);
app.use("/checkins", requireAuth, checkinsRoutes);
app.use("/suggestions", requireAuth, suggestionsRoutes);

app.use((err, _req, res, _next) => {
  console.error("Unhandled backend error:", err);
  res.status(500).json({
    error: err?.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
