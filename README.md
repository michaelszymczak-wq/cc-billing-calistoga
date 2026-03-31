# CC Billing Calistoga

A full-stack billing automation portal for Calistoga Cellars, built to integrate with InnoVint's cellar management system. It automates monthly billing calculations for winery services, storage, fruit intake contracts, and more — with QuickBooks-ready CSV export.

## Features

- **Action-Based Billing** — Fetches winery actions (filters, analyses, custom labor, bottling, barrel operations, etc.) from InnoVint and matches them against configurable rate rules
- **Inventory Storage Billing** — 3-snapshot method for bulk wine (per gallon), barrels, puncheons, tanks, and case goods (per pallet)
- **Fruit Intake Contracts** — Multi-month installment billing with tiered pricing by color, customer-level overrides, deposits, and small lot fees
- **Billable Add-Ons** — Manual one-off charges linked to rate rules
- **Consumables** — Shared costs distributed proportionally across customers by fruit tonnage
- **QuickBooks Export** — Selective CSV export with per-category toggles (actions, storage, fruit, add-ons, consumables, deposits, case goods)
- **Excel Export** — Multi-sheet workbooks with full billing detail
- **Customer Management** — Owner code mapping, display names, contact details, CSV import/export
- **Role-Based Access** — Admin, Team Member, and Cellar roles with Firebase Authentication
- **Rate Table** — Flexible rule matching with priority cascade, setup fees, tiered pricing, and CSV import/export

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 22, Express, TypeScript |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Database | Firebase Firestore (prod) / local JSON file (dev) |
| Auth | Firebase Authentication |
| Hosting | Firebase Hosting + Cloud Run |
| Exports | ExcelJS, CSV |

## Project Structure

```
innovint-billing/
├── backend/
│   └── src/
│       ├── server.ts              # Express app
│       ├── config.ts              # Environment config
│       ├── persistence.ts         # Firestore/file persistence
│       ├── middleware/auth.ts      # JWT auth middleware
│       ├── routes/                 # API endpoints
│       ├── services/              # Business logic
│       └── types/index.ts         # TypeScript interfaces
├── frontend/
│   └── src/
│       ├── App.tsx                # Main app with tab navigation
│       ├── api/client.ts          # Typed API client
│       ├── auth/AuthContext.tsx    # Firebase auth context
│       └── components/            # UI components
├── docs/                          # User documentation
├── Dockerfile                     # Multi-stage Docker build
├── firebase.json                  # Firebase hosting config
└── package.json                   # Root workspace config
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm 7+

### Installation

```bash
cd innovint-billing
npm install
```

### Development

```bash
npm run dev
```

This starts both the backend (port 3007) and frontend (port 5177) concurrently. The Vite dev server proxies `/api` requests to the backend.

### Production Build

```bash
npm run build
npm start
```

Builds the frontend into `backend/public/` and compiles the backend. Runs on port 3001.

### Docker

```bash
docker build -t cc-billing-calistoga .
docker run -p 3001:3001 \
  -e USE_FIRESTORE=true \
  -e GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json \
  cc-billing-calistoga
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3007 (dev) / 3001 (prod) | HTTP server port |
| `USE_FIRESTORE` | `false` | `true` for Firestore, `false` for local JSON file |
| `NODE_ENV` | `development` | Auth is bypassed in dev mode |
| `CONFIG_PATH` | `~/.cc-billing-calistoga-config.json` | Local config file path |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Firebase service account JSON (required for Firestore) |

## First-Time Setup

1. **Settings** — Enter InnoVint API credentials (access token, winery ID) and set storage rates
2. **Customers** — Map InnoVint owner names to billing codes and display names
3. **Rate Table** — Configure billing rules for each action type with rates, setup fees, and matching criteria
4. **Fruit Intake** — Set up color rate tiers, contract defaults, and run fruit intake to pull records from InnoVint

## Billing Workflow

1. Select a billing month/year and run billing
2. Review results across tabs: Actions, Audit, Bulk Inventory, Barrel Inventory, Case Goods
3. Rectify any unmatched actions from the Audit tab
4. Go to QB Export, toggle desired categories, and generate preview
5. Download CSV for QuickBooks import or Excel for detailed records
