# StoreHub Rwanda

Multi-tenant e-commerce store builder for Rwandan businesses: sign up → create store → pick template → customise with drag-and-drop → add products → publish → take orders paid with **MTN Mobile Money** (or on delivery). Prices in **RWF**.

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind v4 · Prisma + PostgreSQL · dnd-kit · Zod · jose (sessions) · Vitest

## Quick start (local)

```bash
cp .env.example .env          # fill DATABASE_URL, DIRECT_URL, AUTH_SECRET, APP_ENCRYPTION_KEY
createdb storehub
npm install
npx prisma migrate dev        # creates tables
npm run db:seed               # plans, admin (if SEED_ADMIN_PASSWORD set), demo store
npm run dev
```

| URL | What |
|---|---|
| http://localhost:3000 | Marketing site / sign up |
| http://kigalifashion.localhost:3000 | Demo store on its subdomain (`*.localhost` works in Chrome/Firefox) |
| http://localhost:3000/s/kigalifashion | Same store via path (no DNS needed) |
| http://localhost:3000/dashboard | Merchant dashboard — `demo@storehub.rw` / `Demo12345!` |
| http://localhost:3000/admin | Platform admin — `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` |

Emails (verification, password reset) are printed to the server log until a mail provider is wired into `lib/mail.ts`.

## MTN MoMo

All `MTN_MOMO_*` variables are **blank on purpose**. With them blank:

* `MOMO_DEV_SIMULATOR=true` (dev only, ignored in production) → checkout works end-to-end and the order page shows **Approve / Decline** buttons standing in for the phone prompt.
* Otherwise MoMo is hidden at checkout and only pay-on-delivery is offered.

When sandbox credentials arrive, set `MTN_MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com`, the subscription key, API user/key, `MTN_MOMO_TARGET_ENVIRONMENT=sandbox`, `MTN_MOMO_CURRENCY=EUR` (sandbox only accepts EUR) and `MTN_MOMO_CALLBACK_URL=https://<your-host>/api/payments/momo/callback`.

How payment confirmation works (`lib/payments/service.ts`):

1. Checkout creates the order, reserves stock atomically, creates a `payments` row and sends **Request to Pay** with a fresh `X-Reference-Id`.
2. MTN's `202 Accepted` only moves the payment to `processing` — **never** to paid.
3. The final status comes from the status endpoint, triggered by (a) the callback, (b) the order page polling, (c) the `/api/cron/payments` sweep (every 5 min, `Authorization: Bearer $CRON_SECRET`).
4. Callbacks carry an HMAC-signed reference and are only a trigger: status is re-fetched from MTN before anything changes, so a forged callback can't mark an order paid. Amount mismatches are rejected.
5. Every transition is an atomic conditional update — duplicate callbacks / concurrent polls are logged in `payment_events` and ignored.
6. Unpaid MoMo orders are cancelled after 2 h and their stock released; customers can retry a failed/declined payment from the order page.

> ⚠️ **Business decision required before production:** this build collects through **one platform MTN account**. Settlement to individual merchants (or per-merchant MTN accounts — `store_settings.momoCredentialsEnc` is reserved and must be encrypted with `lib/security/crypto.ts`) must be agreed with MTN. Customer → store payments and store → platform subscription payments are separate `PaymentKind`s.

## Architecture

* **Multi-tenancy** — `middleware.ts` maps `<slug>.<root domain>` and verified custom domains to `/s/<key>/…`. Every store-scoped table has `storeId`; dashboard code gets the store only from `requireStore()` / `assertStorePermission()` (server-side membership check) and scopes every query with it. `prisma/rls.sql` adds PostgreSQL RLS policies as a second wall (`npm run db:rls`) for deployments that connect with a non-owner role — see the header of that file.
* **Roles** — platform: `PLATFORM_ADMIN` / `USER`; per store: `OWNER` / `MANAGER` / `STAFF` (`lib/tenants/permissions.ts`). Managers can design but not publish; staff handle orders.
* **Website builder** — the layout is JSON (`lib/editor/schema.ts`, Zod-validated on every save), never raw HTML. One section registry (`lib/editor/sections.ts`) drives both the editor's properties panel and the shared renderer (`components/storefront/sections.tsx`). Templates (`templates/index.ts`) are just starting configs. Draft and published configs are separate; the public store only ever reads the published one.
* **Responsive preview** — storefront components use Tailwind **container queries** (`@3xl:` etc.), so the editor's mobile canvas shows the real mobile layout.
* **Editor** — dnd-kit drag from library → canvas and sortable reordering, undo/redo (coalesced typing), debounced autosave, desktop/mobile preview, section hide/duplicate/delete, theme colours/fonts/corners, SEO, multiple pages, image upload.
* **Uploads** — type is detected from magic bytes (JPG/PNG/WebP/GIF, ≤ 5 MB). Stored in Supabase Storage (`media` bucket) when `NEXT_PUBLIC_SUPABASE_URL` + service key are set, otherwise in `./storage/uploads`.
* **Plans** — Starter / Business / Professional with enforced limits (product count, MoMo, custom domain, templates). Upgrades are requested by merchants and activated manually by an admin during the pilot.

## Data protection (Law No. 058/2021)
Draft privacy, terms and cookie pages are at `/legal/*` and **need legal review**. Registration records consent; merchants can erase a customer's personal data (orders are anonymised, amounts kept). Audit logs cover sensitive actions. Review controller/processor registration with the DPO (dpo.gov.rw) before launch.

## Scripts
`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run db:migrate` · `npm run db:seed` · `npm run db:rls`

## Not in this MVP
Email provider, staff invitations UI, CSV import, automated courier integration, subscription payment collection via MoMo (records exist; collection is manual), DNS-based custom domain verification (admin verifies manually).
# shopifystore
