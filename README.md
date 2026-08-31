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

---

## 🔐 Access Provisioning

Access is provisioned privately by a workspace administrator or deployment owner. Do not publish or commit account details in documentation, screenshots, tickets, or repository files.

---

## 📁 Project Structure

```
teinco-finance-app/
├── prisma/
│   ├── schema.prisma      # Database schema (18 tables)
│   └── teinco_finance.db  # SQLite database (local)
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

- **Engine:** SQLite (file-based)
- **Location:** `prisma/teinco_finance.db`
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
│   React 18 UI   │────▶│  Express API    │────▶│  SQLite (Local) │
│   (Port 5173)   │◄────│  (Port 3001)    │◄────│  (Prisma ORM)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                                               │
       │              All on YOUR computer               │
       │         No internet required for core           │
       └───────────────────────────────────────────────┘
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite + Prisma ORM |
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
3. Add a persistent Railway Volume mounted at `/data`.
4. Add the required service variables privately in Railway. Keep all account details out of README files, screenshots, deployment notes, and public issue trackers.

```bash
JWT_SECRET=<private-value>
SEED_DEMO_DATA=false
```

You do not need to set `PORT`; Railway provides it automatically. When the `/data` volume is attached, the app stores SQLite at:

```bash
/data/teinco_finance.db
```

### Railway commands

Railway can use the normal package scripts:

```bash
npm run build
npm start
```

`npm start` runs `prisma db push` before booting the server, which creates or updates the SQLite schema on the runtime volume.

### Optional CLI deploy

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway volume add --mount-path /data
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
2. Or copy the file directly: `cp prisma/teinco_finance.db backups/`

### Automatic Backup
- Configure in Settings
- Default: every 24 hours
- Files saved to `./backups/` with timestamp

### Restore
1. Stop the application
2. Replace `prisma/teinco_finance.db` with your backup
3. Restart

---

## 🌐 Future Roadmap

1. **Electron Desktop App** — Native window, auto-updater
2. **Bank Feed Import** — HDFC, ICICI, SBI CSV import
3. **AI Invoice OCR** — Extract data from receipts
4. **"Ask Finance"** — Natural language queries via LLM
5. **Multi-user Sync** — Optional Supabase/PostgreSQL backend
6. **GST Export** — GSTR-ready Excel output
7. **Mobile App** — React Native companion

---

## ⚠️ Known Limitations

1. **Single-user** — Multi-user requires cloud backend (future)
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

**Database location:** `prisma/teinco_finance.db`  
**Backup location:** `./backups/` (configurable)
