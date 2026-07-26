# PTracker v5

PTracker is a modular, multi-project project-controls application for delivery
planning, financial performance, actual effort, invoicing and governance.

It is a full Next.js rewrite of the former single-file Financial Tracker. The
repository is structured around independently testable business modules and a
shared Firebase data and security layer.

## What is implemented

- Firebase Authentication with email/password, Google and Microsoft providers
- Optional Firebase App Check using reCAPTCHA Enterprise
- Project membership and six project roles
- Multi-project workspace with isolated project data
- Executive Dashboard with BAC, AC, EV, ETC, EAC, VAC and schedule health
- Versioned, locked Forecast baseline imports from Excel or CSV
- Actuals grid with FI import, Days-before-Hours logic, ANZ/IND conversion,
  boundary-week display, month reconciliation and invoice locks
- Invoice periods, duplicate-period prevention, PO controls, evidence snapshots,
  workflow status, credit notes and lock release on eligible deletion
- Dedicated SVG POAP engine with empty workstreams, Week/Month redraw, lane
  packing, drag, resize, multi-select, bulk changes, dependencies, CPM critical
  path, automatic rescheduling, baselines, milestones and undo/redo
- Customer-safe views that omit internal rate and cost data
- PDF, PNG, PowerPoint, Excel, CSV and JSON exports
- Administration for users, roles, holidays, POs, backups, restore, project
  archive/reset and audit review
- Strict Firestore and Storage rules plus emulator test coverage
- GitHub Actions for lint, type checks, unit tests, production build and rules

## Technology

- Next.js 16 App Router, React 19 and strict TypeScript
- Tailwind CSS and reusable ShadCN-style primitives
- Firebase Authentication, Firestore, Storage and App Check
- TanStack Table, React Hook Form, Zod, Recharts and SheetJS
- jsPDF and PptxGenJS
- Vitest, React Testing Library, Playwright and Firebase Emulator Suite
- Firebase App Hosting

## Start locally

Requirements: Node.js 22 or later.

```powershell
git clone https://github.com/steveholbrook/PTracker.git
cd PTracker
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Until Firebase values are added, use **Explore as
Administrator** to enter the self-contained demonstration workspace.

## Verify

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Firebase rule tests additionally require Java 21:

```powershell
npm run test:rules
```

Playwright browser tests require the Chromium test browser:

```powershell
npx playwright install chromium
npm run test:e2e
```

## Deployment

Follow [docs/deployment.md](docs/deployment.md). It is written for a first-time
Windows deployment and uses:

- `develop` → development Firebase App Hosting backend
- `main` → production Firebase App Hosting backend

Firebase App Hosting is intentional. PTracker has dynamic project routes and an
authenticated application shell; forcing it into a static export would remove
useful Next.js deployment capabilities.

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Security](docs/security.md)
- [Beginner deployment](docs/deployment.md)
- [User guide](docs/user-guide.md)

## Important production controls

Never deploy open rules such as `allow read, write: if true`. Never commit
`.env.local` or service-account credentials. Create separate Firebase projects
for development and production, test customer access with a real customer role,
and configure Firebase budget alerts before wider use.

