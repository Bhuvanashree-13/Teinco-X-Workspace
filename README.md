# Teinco-X Finance

**Local-First Finance & Expense Management System for Teinco-X.ai**

A production-quality, desktop-class financial operating system designed for bootstrapped technology startups. All data is stored locally on your machine — no cloud required.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and **npm**
- **Git** (optional)

### Setup (One Command)

```bash
# On macOS/Linux:
./setup.sh

# On Windows:
npm install
npx prisma generate
npx prisma db push
```

### Run

```bash
npm run dev
```

This starts:
- **Backend API** at `http://localhost:3001`
- **Frontend UI** at `http://localhost:5173`

Open your browser to **http://localhost:5173**

### Mobile app (iOS and Android)

The bare React Native client lives in `mobile/` and connects to the same Express API and MySQL database as the web app. The production Railway API URL is built into the client.

```bash
npm run mobile:dev
```

Use `npm run mobile:android` to compile and install a development build on an emulator or USB-connected device. Admins receive dashboard, expense, and subscription access. Employees receive their privacy-scoped workspace view and shared subscription access. JWT credentials are stored in the native Android Keystore/iOS Keychain.

#### Build a standalone Android APK

The release APK runs independently after installation; no cloud build account, QR code, or Metro development server is required. Install JDK 17 and Android Studio with the Android SDK first, then set `JAVA_HOME` and `ANDROID_HOME`.

```bash
cd mobile
npm install
npm run build:apk
```

The APK is generated locally at `mobile/android/app/build/outputs/apk/release/app-release.apk`. The checked-in native template currently uses its development keystore for local internal distribution; configure a private release keystore before Play Store or public distribution.

---

## 🔐 Access Provisioning

Access is provisioned privately by a workspace administrator or deployment owner. Do not publish or commit account details in documentation, screenshots, tickets, or repository files.

---

## 📁 Project Structure

```
teinco-finance-app/
├── prisma/
│   └── schema.prisma      # MySQL database schema
├── server/
│   ├── index.ts           # Express server entry
│   ├── db.ts              # Prisma client
│   ├── seed.ts            # Demo data generator
│   └── routes/            # API routes
│       ├── auth.ts
│       ├── dashboard.ts
│       ├── expenses.ts
│       ├── vendors.ts
│       ├── subscriptions.ts
│       ├── categories.ts
│       ├── projects.ts
│       ├── employees.ts
│       ├── assets.ts
│       ├── analytics.ts
│       ├── reports.ts
│       ├── backup.ts
│       ├── settings.ts
│       └── import-export.ts
├── src/
│   ├── components/        # React pages
│   │   ├── Dashboard.tsx
│   │   ├── Expenses.tsx
│   │   ├── Vendors.tsx
│   │   ├── Subscriptions.tsx
│   │   ├── Analytics.tsx
│   │   ├── Settings.tsx
│   │   ├── Layout.tsx
│   │   └── Sidebar.tsx
│   ├── hooks/
│   │   └── useApi.ts      # Data fetching hook
│   ├── lib/
│   │   └── utils.ts       # Helpers (formatCurrency, formatDate)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 🗄️ Database

- **Engine:** MySQL
- **Hosting:** Railway MySQL
- **ORM:** Prisma
- **Tables:** 18 normalized tables

### Key Tables
| Table | Purpose |
|-------|---------|
| `Expense` | All expenses with GST, multi-currency, attachments |
| `Vendor` | Vendor directory with spend tracking |
| `Subscription` | Recurring subscriptions with renewal dates |
| `Employee` | People costs (salaries, contractors, freelancers) |
| `Asset` | Hardware/GPU/server asset tracking |
| `Project` | Product/project cost allocation |
| `ExpenseCategory` | Hierarchical category system |
| `Budget` | Budget vs actual tracking |
| `AuditLog` | Complete audit trail |
| `BackupRecord` | Backup history |

---

## ✨ Features

### Dashboard
- Real-time KPI cards (current month, YTD, burn rate)
- Monthly spend trend chart
- Category breakdown (donut chart)
- Upcoming recurring expenses
- Burn rate analysis with smart insights

### Expense Management
- Full CRUD with unique IDs (EXP-2026-000001)
- GST support (CGST, SGST, IGST, TDS)
- Multi-currency (INR, USD, EUR, GBP) with exchange rates
- Hierarchical categories (10 parents, 40 subcategories)
- Project & cost center allocation
- Attachment support (schema ready)
- Advanced search & filtering
- Pagination (handles 100K+ records)

### Vendor Management
- Vendor directory with contact info, GSTIN, PAN
- Year-over-year spend comparison
- Transaction count & active subscriptions
- Vendor type classification

### Subscription Tracking
- 16 demo subscriptions pre-loaded
- Renewal calendar
- Billing cycle tracking (monthly/yearly/quarterly)
- Auto-renewal flags
- Status management (active/trial/cancelled)

### Analytics
- Spend by Category (pie chart)
- Spend by Vendor (horizontal bar chart)
- Project Allocation (pie chart)
- All charts use real database data

### Settings
- Company info (name, GSTIN, PAN)
- Base currency & reporting year
- Backup configuration
- Local data ownership notice

### Data Import/Export
- Export to Excel (.xlsx)
- Export to JSON
- CSV-ready architecture

### Backup & Restore
- One-click backup
- Timestamped files: `teincox_finance_backup_2026-08-26_15-30.db`
- Automatic backup scheduling
- Restore from backup

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React 18 UI   │────▶│  Express API    │────▶│ Railway MySQL   │
│   (Port 5173)   │◄────│  (Port 3001)    │◄────│  (Prisma ORM)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | Railway MySQL + Prisma ORM |
| Charts | Recharts |
| Export | xlsx (SheetJS) |

---

## 🔒 Security

- Local authentication with bcrypt + JWT
- Session timeout support
- Input validation via Zod-ready architecture
- SQL injection protection (Prisma parameterized queries)
- XSS protection (React escapes by default)
- Database file permissions controlled by OS

---

## 📊 Demo Data

The application comes pre-loaded with **realistic Teinco-X data**:

- **60+ expenses** across 7 months (Jan-Jul 2026)
- **25 vendors** (Microsoft, AWS, Google Cloud, NVIDIA, etc.)
- **16 subscriptions** with renewal tracking
- **8 employees/contractors** with salary data
- **14 hardware assets** (GPUs, servers, workstations)
- **10 categories** with 40 subcategories
- **7 projects** (Spandana, Vyom, AI Infrastructure, etc.)

All demo data is clearly marked and can be reset via the database.

---

## 🛠️ Development Commands

```bash
# Start development (both frontend + backend)
npm run dev

# Start only backend
npm run server:dev

# Start only frontend
npm run client:dev

# Build for production
npm run build

# Open Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma client after schema changes
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma db push --force-reset
```

---

## 📦 Production Build

```bash
# Build frontend and backend
npm run build

# Start production server
npm start
```

In production, the Express server serves both the API and the built React app from one service.

---

## 🚄 Deploy on Railway

This app is ready to deploy as a single Railway service.

### Recommended Railway setup

1. Push this project to GitHub.
2. In Railway, click **New Project → Deploy from GitHub Repo** and select this repository.
3. Add a Railway **MySQL** database to the same project.
4. Open the app service → **Variables** and add/reference the MySQL connection URL privately. Railway MySQL provides `MYSQL_URL`; the app also accepts it as `DATABASE_URL`.
   - Use the full connection URL that starts with `mysql://`.
   - Do not set `DATABASE_URL` to only a host name or internal domain.
   - If Railway gives separate values instead, the app can build the URL from `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE`.
5. Add the remaining required service variables privately in Railway. Keep all account details out of README files, screenshots, deployment notes, and public issue trackers.

```bash
DATABASE_URL=<private Railway MySQL URL>
# or MYSQL_URL=<private Railway MySQL URL>
JWT_SECRET=<private-value>
SEED_DEMO_DATA=false
```

You do not need to set `PORT`; Railway provides it automatically.

### Railway commands

Railway can use the normal package scripts:

```bash
npm run build
npm start
```

`npm start` runs `prisma db push` before booting the server, which creates or updates the MySQL schema using the private MySQL connection URL.

### Optional CLI deploy

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway redeploy
```

After deployment, open the Railway service and generate a public domain from **Settings → Networking → Generate Domain**.

---

For desktop packaging, consider:
- **Electron** (recommended for cross-platform desktop)
- **Tauri** (lighter alternative)

---

## 🔄 Backup Instructions

### Manual Backup
1. Go to **Settings → Backup & Data**
2. The app creates a JSON export backup record.

### Automatic Backup
- Configure in Settings
- Default: every 24 hours
- Files saved to `./backups/` with timestamp

### Restore
1. Use Railway MySQL backups/snapshots when available.
2. Keep app-generated JSON exports as a secondary audit copy.

---

## 🌐 Future Roadmap

1. **Electron Desktop App** — Native window, auto-updater
2. **Bank Feed Import** — HDFC, ICICI, SBI CSV import
3. **AI Invoice OCR** — Extract data from receipts
4. **"Ask Finance"** — Natural language queries via LLM
5. **Advanced database backups** — Automated managed database snapshots
6. **GST Export** — GSTR-ready Excel output
7. **Mobile expansion** — Notifications, offline caching, and receipt capture

---

## ⚠️ Known Limitations

1. **Database backups** — Prefer Railway managed database snapshots for production restores
2. **No live bank feeds** — Manual import or CSV only
3. **No GST filing** — Export to accountant, don't file directly
4. **Attachment uploads** — UI ready, file storage needs Multer setup
5. **Exchange rates** — Manual entry, no live API

---

## 📄 License

Proprietary — All financial data belongs to Teinco-X.ai.

---

## 🆘 Support

For issues or feature requests, contact the Teinco-X engineering team.

**Database:** Railway MySQL via private `DATABASE_URL` or `MYSQL_URL`  
**Backup location:** `./backups/` JSON exports plus Railway database snapshots

## Google sign-in (web)

Admins and employees can sign in with Google using their existing, active workspace login. Their role and employee access come from the database; Google sign-in never creates users or grants admin access.

1. In [Google Cloud](https://console.cloud.google.com/auth/clients), configure Google Auth Platform branding and audience, then create an OAuth client with application type **Web application**.
2. Add the exact website origin under **Authorized JavaScript origins**, such as `https://your-app.up.railway.app`. For local development add `http://localhost:5173`. Origins have no path or trailing slash. This uses the Google popup/JavaScript callback flow, so no redirect URI or client secret is required. If the consent app is in testing, add the intended users as test users; choose an audience that includes both your admins and employees.
3. Set `GOOGLE_CLIENT_ID` to that client ID and configure a strong `JWT_SECRET` on the app server (Railway service variables in production). Restart/redeploy the service. The client ID is served at runtime, so no Vite environment variable is needed. Local development must export these variables into the server process environment.
4. Apply the additive schema update with `npm run db:push` and regenerate with `npm run db:generate`. Production startup first prepares the nullable Google subject column and unique index with an idempotent, additive migration, then runs the normal guarded `prisma db push`. It stops if duplicate non-null Google subjects exist; it never enables `--accept-data-loss`. Dependency installation generates Prisma Client. This adds a nullable, unique `User.googleSubject`; existing users and passwords are retained.
5. Provision each user's Gmail or Google Workspace email in People / Admin users, then use **Sign in with Google** on the web login page. Initial linking requires an authoritative Gmail or Google Workspace address. Other third-party email addresses registered with Google continue using password sign-in.

The server verifies Google's signature, audience, issuer, expiry, verified email, and a browser-bound nonce before issuing the normal workspace session. Linked accounts are identified by Google's stable subject ID. Unknown or inactive users are rejected. First-time employee Google sign-in closes the pending first-password setup path; existing configured passwords still work. A Google-only employee will need a password reset before using password login.

When Google configuration is absent, password sign-in remains available and a disabled Sign in with Google button explains that workspace setup is pending. Production must use HTTPS for the sign-in challenge cookie. If a reverse proxy sets Cross-Origin-Opener-Policy, use `same-origin-allow-popups` so Google popup login can work. Native React Native sign-in is unchanged.

Validation: `npm run test:schema`, `npm run test:auth`, and `npm run build`. To smoke-test deployment, sign in with a provisioned admin and employee, verify their respective access, then confirm an unprovisioned account is refused. Real Google popup testing requires the configured client ID and an authorized origin.

Reference: [Google server-side ID token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).


### Ask AI model connection

Local development reads `.env` when running `npm run dev`. Set `ASK_AI_OLLAMA_URL` to your Ollama base URL (for example `http://127.0.0.1:11434`) and `ASK_AI_MODEL` to an installed model from `ollama list`. Optionally set `ASK_AI_API_KEY` for an authenticated Ollama gateway. Restart the app server after changing these values.

For a hosted deployment, set these variables on the application service. The endpoint must be reachable from that server; localhost refers to the hosted server, not your computer. Never put gateway credentials in `VITE_` variables.

Open Flow → Ask AI → Test connection to verify model output using synthetic facts without reading financial records. Requests allow up to two minutes for local CPU inference. Ask AI returns only validated, sourced workspace facts; the model cannot modify records. Settings includes connection setup guidance.
