# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (whitelabel)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── cloud-marketplace/  # React+Vite frontend (Cloud Services Marketplace)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Cloud Services Marketplace

A premium B2B cloud services marketplace where users can browse, filter, and request cloud servers from multiple providers.

### Features
- **Authentication**: Clerk-based sign in/sign up
- **Landing page**: Public marketing page for signed-out users
- **Dashboard**: Stats overview (orders by status, available services, recent orders)
- **Services catalog**: Filter by provider/region, request servers via modal
- **My Orders**: View all orders with color-coded status badges
- **Multilingual**: English + Arabic with RTL support (dir="rtl")
- **Responsive**: Mobile (collapsible drawer), tablet, desktop

### Database Schema
- `cloud_services` — provider listings (Contabo, Google Cloud, Alibaba Cloud, Huawei Cloud)
- `server_orders` — user orders with status (Pending/Active/Failed)

### API Routes
- `GET /api/services` — list cloud services (filter: provider, region, minPrice, maxPrice)
- `GET /api/services/:id` — get single service
- `GET /api/orders` — get current user's orders (auth required)
- `POST /api/orders` — create a new order (auth required, mock provisioning)
- `GET /api/orders/:id` — get single order (auth required)
- `GET /api/stats/dashboard` — dashboard stats (auth required)
- `GET /api/stats/providers` — provider stats breakdown

### Seed Data
13 realistic cloud service records seeded across 4 providers:
- Contabo (VPS S/M/L/XL)
- Google Cloud (e2-standard-4, e2-standard-8, n2-standard-16)
- Alibaba Cloud (ecs.c6.xlarge, ecs.g6.2xlarge, ecs.hfg7.4xlarge)
- Huawei Cloud (c3.xlarge.4, c3.2xlarge.4, c3.4xlarge.4)
