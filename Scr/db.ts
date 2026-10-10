import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donations (
      id BIGSERIAL PRIMARY KEY,
      receipt_id TEXT NOT NULL UNIQUE,
      user_id BIGINT NOT NULL,
      username TEXT NOT NULL,
      product_id BIGINT NOT NULL,
      amount_robux INTEGER NOT NULL CHECK (amount_robux > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS donations_user_id_idx ON donations(user_id);
    CREATE INDEX IF NOT EXISTS donations_created_at_idx ON donations(created_at DESC);
  `);
}
