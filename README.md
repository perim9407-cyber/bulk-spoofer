# Sakurayama / Para Anomali Donation Backend

Node.js + TypeScript + Express + PostgreSQL backend for recording Roblox Developer Product donation receipts and serving public leaderboards.

## API

- `GET /health` — health check
- `GET /api/leaderboard?limit=10` — donors ranked by total Robux
- `GET /api/donations/recent?limit=10` — latest donations
- `POST /api/donations/record` — internal endpoint; requires `x-game-api-key`

The record endpoint is idempotent on `receiptId` (Roblox `PurchaseId`) so retries do not double-count donations.

## Run locally

Requires Node.js 20+ and PostgreSQL.

```bash
npm install
cp .env.example .env
# Edit .env and set DATABASE_URL and a random GAME_API_KEY (32+ chars)
npm run dev
```

Open `http://localhost:3000/health`.

## Deploy to Railway

1. Create a GitHub repository and upload this folder's contents.
2. In Railway, create a project and choose **Deploy from GitHub Repo**.
3. Add a PostgreSQL service to the same Railway project.
4. In the backend service Variables, add:
   - `DATABASE_URL`: reference the PostgreSQL service's `DATABASE_URL` variable (Railway's variable reference picker is preferred).
   - `GAME_API_KEY`: a unique random secret of at least 32 characters.
   - `NODE_ENV`: `production`
5. Railway uses `railway.json`; build command is `npm run build`, start command runs `npm run db:migrate && npm start`.
6. In backend service Settings > Networking, generate a public domain.
7. Test `https://YOUR-DOMAIN/health`; expected JSON: `{"ok":true,"service":"sakurayama-donations"}`.
8. Copy the domain and `GAME_API_KEY` into `roblox/DonationReceipt.server.lua`. Keep the key only in a server Script. Never put it in a LocalScript.
9. In Roblox Studio, enable **Game Settings > Security > Allow HTTP Requests**.
10. Replace the example Developer Product IDs and amounts in `DonationReceipt.server.lua` with the real product IDs and exact prices.

## Security and operational notes

- Do not expose `GAME_API_KEY` in a LocalScript or public repository.
- Public leaderboard endpoints are read-only. The write endpoint is protected by a shared secret.
- Configure `ProcessReceipt` in exactly one server script in the experience. If another script already assigns `MarketplaceService.ProcessReceipt`, merge the logic; Roblox only supports one active callback.
- Product amounts must come from a server-owned product ID mapping, never from client input.
- Ensure every configured Developer Product ID belongs to the intended experience and corresponds to the exact listed price.
- This sample stores the username observed at receipt time. The Roblox UserId is the stable identity.
- For higher security, consider adding per-game signing/rotating secrets, request rate limits, monitoring, and a reconciliation process.
- If the backend is temporarily unavailable, the receipt callback returns `NotProcessedYet` so Roblox can retry. Do not return `PurchaseGranted` until the backend has accepted the receipt.
- Test with a private test experience before production. Roblox purchase receipts should be tested carefully.
