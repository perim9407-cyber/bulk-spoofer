import "dotenv/config";
import { ensureSchema, pool } from "./db";

ensureSchema()
  .then(() => {
    console.log("Database schema ready.");
    return pool.end();
  })
  .catch(async (err) => {
    console.error("Database migration failed:", err);
    await pool.end();
    process.exit(1);
  });
