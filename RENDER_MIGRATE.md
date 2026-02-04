# Run database migrations on Render

The error `The column chatTheme does not exist` means the production database hasn’t had the chat-rooms migration applied. Apply migrations as follows.

## Option A: One-time fix (Render Shell)

1. In Render dashboard: open your **backend service** → **Shell** (or use a one-off job with the same env).
2. Ensure you’re in the app directory (Render often uses project root; if your backend is in a subdir, `cd` into it, e.g. `cd EchoRoom_backend`).
3. Run:
   ```bash
   npx prisma migrate deploy
   ```
4. Confirm it prints applied migrations (e.g. `20260203200000_chat_rooms_real`).
5. Redeploy the service once (or just retry creating a room).

## Option B: Run migrations on every deploy (recommended)

1. In Render dashboard: **backend service** → **Settings** → **Build & Deploy**.
2. Find **Release Command**.
3. Set it to:
   ```bash
   npx prisma migrate deploy
   ```
   If your Render **Root Directory** is the repo root and the backend lives in `EchoRoom_backend`, use:
   ```bash
   cd EchoRoom_backend && npx prisma migrate deploy
   ```
4. Save. The next deploy will run migrations before starting the app.

**Requirements:** `DATABASE_URL` (and `DIRECT_URL` if you use it) must be set in the service’s **Environment** so Prisma can connect to the same DB you use in production.

After migrations are applied, creating a room should succeed.
