# cca-PaaS — Cloud Services Marketplace

A premium B2B cloud infrastructure marketplace that lets enterprises browse, compare, and provision cloud servers from multiple top-tier providers through a single unified platform.

## Features

- **Multi-provider Catalog** — Contabo, Google Cloud, Alibaba Cloud, Huawei Cloud
- **Authentication** — Secure sign-in / sign-up with role-based access control
- **Dashboard** — Real-time stats: active services, pending deployments, failed provisioning
- **Order Management** — Full lifecycle tracking (Pending → Provisioning → Active / Failed / Cancelled)
- **Admin Panel** — User management, order control, service CRUD, system updates
- **Multilingual** — English + Arabic with full RTL layout support
- **Responsive UI** — Mobile, tablet, and desktop — premium DigitalOcean/Vercel-quality design

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Auth | Clerk |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| API Spec | OpenAPI 3.1 + Orval codegen |
| Monorepo | pnpm workspaces |

## Project Structure

```
cca-PaaS/
├── artifacts/
│   ├── api-server/          # Express REST API
│   └── cloud-marketplace/   # React + Vite frontend
├── lib/
│   ├── api-spec/            # OpenAPI specification
│   ├── api-client-react/    # Auto-generated React Query hooks
│   ├── api-zod/             # Auto-generated Zod schemas
│   └── db/                  # Drizzle schema + DB connection
└── scripts/                 # Utility scripts
```

## Quick Deploy (Docker — 3 lines)

```bash
git clone https://github.com/Riydx0/cca-PaaS && cd cca-PaaS
cp .env.example .env   # edit .env with your Clerk keys and a strong DB_PASSWORD
docker compose up -d --build
```

The app will be live at **http://your-server-ip** on port 80.

> **Requirements:** Docker 24+ and Docker Compose v2 installed on the server.
> Get Docker: `curl -fsSL https://get.docker.com | sh`

### First Run (Admin Setup)

After the containers start, set up your super_admin:

1. Open `http://your-server-ip` and sign up
2. Go to `http://your-server-ip/bootstrap` and click **"Grant Super Admin Access"**
3. Sign out and back in — the **Admin Panel** link will appear in the sidebar

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### Environment Variables

Create a `.env` file at the root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cca_paas
CLERK_SECRET_KEY=sk_...
VITE_CLERK_PUBLISHABLE_KEY=pk_...
SESSION_SECRET=your-secret-here
```

### Install & Run

```bash
# Install dependencies
pnpm install

# Push DB schema
pnpm --filter @workspace/db run db:push

# Seed database
pnpm --filter @workspace/db run seed

# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend (separate terminal)
pnpm --filter @workspace/cloud-marketplace run dev
```

## Admin Setup

After signing up, call the bootstrap endpoint once to grant super_admin access:

```bash
POST /api/admin/bootstrap
```

Sign out and back in to activate the role. From there, manage users, orders, and services via the Admin Panel.

## Developer

**riyadh alafraa**
