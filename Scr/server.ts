import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { z } from "zod";
import { ensureSchema, pool } from "./db";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 3000);
const GAME_API_KEY = process.env.GAME_API_KEY;

if (!GAME_API_KEY || GAME_API_KEY.length < 32) {
  throw new Error("Set GAME_API_KEY to a random secret of at least 32 characters.");
}

function requireGameKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-game-api-key");
  if (!key || key !== GAME_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "sakurayama-donations" }));

app.get("/api/leaderboard", async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit ?? 10);
    const limit = Number.isInteger(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 10;
    const result = await pool.query(
      `SELECT user_id AS "userId", username,
              SUM(amount_robux)::bigint AS "totalRobux",
              COUNT(*)::int AS "donationCount",
              MAX(created_at) AS "lastDonationAt"
       FROM donations
       GROUP BY user_id, username
       ORDER BY SUM(amount_robux) DESC, MIN(created_at) ASC
       LIMIT $1`,
      [limit]
    );
    res.setHeader("Cache-Control", "public, max-age=15");
    return res.json({ leaderboard: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error" });
  }
});

app.get("/api/donations/recent", async (req, res) => {
  try {
    const raw = Number(req.query.limit ?? 10);
    const limit = Number.isInteger(raw) ? Math.min(50, Math.max(1, raw)) : 10;
    const result = await pool.query(
      `SELECT user_id AS "userId", username, amount_robux AS "amountRobux",
              created_at AS "createdAt"
       FROM donations ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.setHeader("Cache-Control", "public, max-age=10");
    return res.json({ donations: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error" });
  }
});

const receiptSchema = z.object({
  receiptId: z.string().min(1).max(200),
  userId: z.number().int().positive().safe(),
  username: z.string().trim().min(1).max(20),
  productId: z.number().int().positive().safe(),
  amountRobux: z.number().int().positive().max(100000000)
});

app.post("/api/donations/record", requireGameKey, async (req, res) => {
  const parsed = receiptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const d = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO donations (receipt_id, user_id, username, product_id, amount_robux)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (receipt_id) DO NOTHING
       RETURNING id`,
      [d.receiptId, String(d.userId), d.username, String(d.productId), d.amountRobux]
    );
    await client.query("COMMIT");
    // Idempotent: duplicate receipt is acknowledged but never counted twice.
    return res.status(200).json({
      ok: true,
      duplicate: inserted.rowCount === 0
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "internal_error" });
  } finally {
    client.release();
  }
});

app.use((_req, res) => res.status(404).json({ error: "not_found" }));

async function main() {
  await ensureSchema();
  app.listen(PORT, "0.0.0.0", () => console.log(`API listening on ${PORT}`));
}
main().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
