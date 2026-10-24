# Christian Worship Centre — Church Management PWA

A complete church management system and member app for **Christian Worship Centre (CWC)**, built as an installable Progressive Web App that works on any phone, tablet or computer — and keeps working on patchy mobile data.

<p>
  <img src="app/public/icons/icon-192.png" width="64" alt="CWC" />
</p>

**Designed & developed by ProfJero** — *Building Solutions. Empowering Lives.*

---

## What’s inside

### Member app (everyone)
- **Home** — greeting, today’s devotional, quick actions, announcements, upcoming events, latest sermon, testimonies, live-service check-in banner.
- **Devotionals** — daily reader with adjustable text size, bookmarks (saved for offline), share to WhatsApp, previous/next.
- **Events** — upcoming/past, category filters, one-tap RSVP with guests and capacity, add to phone calendar (.ics), share, map link.
- **Sermons** — YouTube (privacy-enhanced) or audio (lighter on data), series filter, search.
- **Give** — church MoMo / bank details with one-tap copy and MoMo how-to (MTN, Telecel, AT), personal giving history, pledge progress, printable giving statement.
- **Care** — prayer, counselling, visitation, urgent needs and testimonies; private or public (prayer wall, optionally anonymous); conversation thread with pastors; works offline (sends when back online).
- **Prayer wall** — “I prayed” counter and published testimonies.
- **Notifications** — in-app inbox + push notifications (devotionals, events, replies), app badge.
- **Profile** — photo, contact details, groups, attendance, SMS opt-out, theme (light/dark/system), change password, install app.
- **QR self check-in** — scan the code shown at church to check yourself in.
- Sign in with **email or phone number** (many members don’t use email).

### Church admin (staff)
| Module | Highlights |
|---|---|
| **Dashboard** | Role-aware KPIs, Sunday attendance trend, income vs expenses, giving by category, birthdays this week, follow-ups, care inbox, upcoming events |
| **People** | Directory with search/filters, rich profiles (GhanaPost GPS, hometown/region, emergency contact, baptism), households, tags, bulk SMS/group/status actions, CSV import with auto column-matching & duplicate detection, CSV export |
| **Groups & ministries** | Departments, fellowships, home cells/bacentas, committees; leaders; SMS a whole group |
| **Follow-ups** | Kanban pipeline (drag & drop) for first-timers, new converts, absentees; notes, assignment, due dates |
| **Attendance** | Start a service, live usher headcounts (multi-device sync), fast name check-in, first-timer registration at the door, QR self check-in, trends, absentee finder → follow-ups/SMS |
| **Giving & finance** | Record tithes/offerings/seeds (cash, MoMo ref, bank, cheque), **batch entry** for envelope stacks, SMS receipts (personalised bulk send), printable receipts & statements, pledges & campaigns (building fund, harvest), expenses with receipt photos, period filters, financial summary print, CSV |
| **Events** | Create/publish with banners, RSVPs list & export, push reminders, SMS attendees |
| **Content** | Devotionals (schedule ahead), sermons (YouTube or audio upload), announcements (pinned, expiry) — with optional push on publish |
| **Pastoral care** | Request inbox, assignment, replies that notify the member, private internal notes, care log (visits, hospital, counselling), testimony moderation |
| **Messages** | SMS via **ProfJero Connect**: audience builder, personalisation (`{first_name|Beloved}`), live page/unit counter with Unicode warning & one-tap fix, cost check against wallet, scheduling, delivery tracking, templates, wallet & MoMo/card top-up; free push notifications |
| **Reports** | Growth, age profile, gender, group sizes, attendance, income/expenses, tithers per month; printable annual report; CSV |
| **Users & roles** | Staff accounts, role changes, deactivation, link app accounts to member records (auto-match by phone), password resets |
| **Settings** | Church profile, giving accounts, categories, service types, SMS defaults, welcome/birthday automation, integration health |
| **Activity log** | Append-only audit trail of important changes |

Plus: ⌘K command palette, dark mode, offline mode, and layouts designed and tested from **320 px phones to 1920 px desktops**.

### Roles

| Role | Can do |
|---|---|
| Super Admin | Everything, including creating other super admins |
| Administrator | Everything except managing super admins |
| Pastor | People, groups, follow-ups, attendance, giving (view), events, content, pastoral care, messaging, reports |
| Treasurer | Giving, pledges, expenses, reports (+ SMS receipts) |
| Secretary | People, groups, follow-ups, attendance, events, content, messaging, reports |
| Ministry Staff | Attendance check-in and follow-ups |
| Viewer | Read-only dashboard, directory and reports |
| Member | Member app only |

Roles are enforced on the server by **Firestore security rules** (`firestore.rules`) and by the API Worker — not just hidden in the UI. Counselling requests and care logs are visible to pastors/admins only.

---

## Architecture

```
┌──────────────────────────┐        ┌───────────────────────────────┐
│  app/  (React PWA)       │  SDK   │  Firebase                      │
│  Vite · TypeScript ·     │◄──────►│  Auth (email/phone-as-login)   │
│  Tailwind · Workbox SW   │        │  Firestore + security rules    │
└─────────┬────────────────┘        └───────────────────────────────┘
          │ ID token                          ▲ caller’s token (rules apply)
          ▼                                   │
┌──────────────────────────┐   secret key   ┌──────────────────────────┐
│  worker/ (Cloudflare)    │───────────────►│  ProfJero Connect SMS    │
│  verifies Firebase token │                └──────────────────────────┘
│  role checks             │   VAPID        ┌──────────────────────────┐
│  SMS proxy · Web Push ·  │───────────────►│  Browser push services   │
│  Cloudinary signing ·    │                └──────────────────────────┘
│  daily birthday job      │   signature    ┌──────────────────────────┐
└──────────────────────────┘◄──────────────►│  Cloudinary (media)      │
                                            └──────────────────────────┘
```

- **No secrets in the browser.** The ProfJero Connect key, VAPID private key and Cloudinary secret live only in the Worker. The Worker verifies Firebase ID tokens (RS256) and reads the caller’s role from Firestore **using the caller’s own token**, so security rules apply there too.
- **Offline-first.** Firestore’s persistent cache plus a Workbox service worker: the app opens and navigates without a connection, and requests/forms queue until reconnected. Member installs don’t download staff-only code.
- **Idempotent SMS.** Every send carries an `Idempotency-Key` that is also its history record id, so a retry after a dropped connection can never double-send or double-charge.

---

## Setting it up

You’ll need: a Google account (Firebase), a Cloudflare account (Workers, free tier is fine), a Cloudinary account, and a **ProfJero Connect** account with an approved Sender ID and a secret API key.

### 1. Firebase
1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method →** enable **Email/Password**.
3. **Firestore Database →** create (production mode, region close to Ghana e.g. `europe-west1`).
4. **Project settings → Your apps →** add a **Web app** and copy its config.
5. Install the CLI and deploy rules & indexes:
   ```bash
   npm install            # at the repo root
   npx firebase login
   npx firebase use --add  # choose your project
   npm run deploy:rules
   ```

### 2. The app
```bash
cd app
cp .env.example .env      # fill in the Firebase config, VITE_API_URL and VITE_CLOUDINARY_CLOUD_NAME
npm install
npm run dev               # http://localhost:5173
```

### 3. The API Worker (`worker/`)
```bash
cd worker
npm install
npm run vapid                              # prints a VAPID key pair
npx wrangler login
npx wrangler secret put PROFJERO_API_KEY   # pk_live_… from ProfJero Connect → API & Integrations
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
```
Edit `wrangler.toml` → `[vars]`: `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGINS` (your app URL), `PROFJERO_SENDER_ID` (e.g. `CWC`), `VAPID_SUBJECT` (`mailto:` your email), `CLOUDINARY_CLOUD_NAME`. Then:
```bash
npm run deploy     # → https://cwc-api.<your-subdomain>.workers.dev  (put this in app/.env as VITE_API_URL)
```

**Optional automations** (daily birthday SMS at 7:00 AM Ghana time, admin password resets for phone-only accounts): create a service account key in Firebase → Project settings → Service accounts, then `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT` and paste the JSON. Turn on “Send birthday SMS automatically” in **Settings**.

### 4. Cloudinary
Signed uploads are used by default (the Worker signs; nothing secret in the app). Alternatively set `VITE_CLOUDINARY_UPLOAD_PRESET` to an **unsigned** preset. Uploads are resized on the phone before sending to save data, and served with automatic format/quality.

### 5. Deploy the app
Firebase Hosting is configured in `firebase.json` (SPA rewrites, immutable asset caching, a no-cache service worker, security headers):
```bash
npm run deploy:hosting    # builds app/ and deploys
```
Any static host works (Cloudflare Pages, Netlify) — serve `app/dist` with SPA fallback to `index.html` and don’t cache `sw.js`.

### 6. First run
Open the app → **Sign in** page shows *“First time here? Set up”* → create the **Super Admin** account. This page locks itself permanently after first use (enforced by security rules). Then:
1. **Settings** — church details, MoMo/bank accounts, Sender ID, SMS signature, welcome & birthday messages.
2. **Users & roles** — add pastors, treasurer, secretary, ushers.
3. **People → Import** — bring in your existing register (CSV from Excel/Google Sheets; a template is provided).
4. Ask members to install the app (Share → *Add to Home Screen* on iPhone; *Install* on Android/desktop) and sign up with their phone number. Link their accounts to member records in **Users & roles** (matching phone numbers are suggested automatically).

---

## Development & testing

Everything runs locally against the Firebase emulators — no real project, SMS or money involved.

```bash
# terminal 1 — Firebase emulators (Auth + Firestore)
npm run emulators
# terminal 2 — realistic demo data (180 members, 10 weeks of services, 6 months of giving…)
npm run seed
# terminal 3 — the app against the emulators
cd app && npm run dev:emulator
# optional — the Worker + a local ProfJero Connect mock
cd worker && node scripts/mock-profjero.mjs &
npx wrangler dev --var EMULATOR:true --var FIREBASE_PROJECT_ID:demo-cwc --var PROFJERO_BASE_URL:http://127.0.0.1:8790 --var "ALLOWED_ORIGINS:*" --var PROFJERO_SENDER_ID:CWC
```
Demo logins (emulator only, password `password123`): `admin@cwc.test`, `pastor@cwc.test`, `treasurer@cwc.test`, `secretary@cwc.test`, `usher@cwc.test`, `member@cwc.test`, and phone login `0241234567`. For the mock SMS API put `PROFJERO_API_KEY=pk_live_test` in `worker/.dev.vars`.

| Suite | Command | Covers |
|---|---|---|
| Security rules | `npm run test:rules` (root) | 20 scenarios: role escalation, private giving, confidential care, prayer wall, RSVP counter integrity, QR check-in, audit log immutability, first-run lock |
| App unit tests | `cd app && npm test` | Ghana phone normalisation, SMS page/unit maths, GSM-safe conversion, personalisation |
| Worker tests | `cd worker && npm test` | Firebase token verification, role enforcement, ProfJero Connect proxying & validation, idempotency, Web Push (RFC 8291 test vector), VAPID, Cloudinary signing, birthday job |
| End-to-end | `cd app && npx playwright test` | **450 responsive checks** (45 screens × 10 sizes, 320–1920 px: no overflow, no errors), user journeys (sign-up by phone, prayer → pastor reply, usher check-in, giving, first-timer follow-up, RSVP, access control, dark mode, SMS through the Worker), PWA install & offline (production build on port 4173) |

---

## Security notes
- Keep `PROFJERO_API_KEY`, `VAPID_PRIVATE_KEY`, `CLOUDINARY_API_SECRET` and `FIREBASE_SERVICE_ACCOUNT` as **Worker secrets** only. Never put them in `app/.env`.
- The previous RGCI codebase (still in this repository’s git history) contained a VAPID private key and account identifiers in client code. CWC uses new keys generated by `npm run vapid`; if those old RGCI keys are still in use anywhere, rotate them.
- Firestore rules are the source of truth for access. If you change roles in `app/src/lib/permissions.ts`, update `firestore.rules` and `worker/src/auth.ts` to match, and run the rules tests.

## Ghana-first details
- Phone numbers accept `024 123 4567`, `+233…`, `233…`; stored as `233XXXXXXXXX`; network detection (MTN/Telecel/AT).
- Currency in GH₵ on screen, but SMS templates use `GHS` — the ₵ sign switches an SMS to Unicode (70 chars/page instead of 160) and the composer warns and fixes it.
- GhanaPost GPS addresses, 16 regions, Latin-Extended fonts for Twi/Ewe letters (ɛ, ɔ, ŋ), Africa/Accra timezone (UTC) for scheduling.
- Data-light: compressed images, audio sermons, lazy-loaded staff code, offline cache.

---

<sub>Christian Worship Centre · crafted by **ProfJero** — Unveiling the Extraordinary.</sub>
