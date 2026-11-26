# ShipRiyadh

Vite + React + TypeScript + Tailwind v4 + Supabase.

## Setup
1. Run `supabase/schema.sql` in the SQL Editor of your ShipRiyadh Supabase project.
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. `npm install`, then `npm run dev` (port 3000) or `npm run build`.

## Vercel
Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Project Settings > Environment Variables
BEFORE building (Vite bakes them in at build time), then redeploy.
Never put the service_role key in this app.
