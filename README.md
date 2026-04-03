# cca-PaaS — Cloud Services Marketplace

A premium B2B cloud infrastructure marketplace that lets enterprises browse, compare, and provision cloud servers from multiple top-tier providers through a single unified platform.

## Features

- **Multi-provider Catalog** — Contabo, Google Cloud, Alibaba Cloud, Huawei Cloud
- **Authentication** — Secure sign-in / sign-up with role-based access control (custom auth, no third-party)
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
| Auth | Custom (express-session + bcrypt + PostgreSQL) |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Monorepo | pnpm workspaces |

## Project Structure

```
cca-PaaS/
├── artifacts/
│   ├── api-server/          # Express REST API
│   └── cloud-marketplace/   # React + Vite frontend
├── lib/
│   └── db/                  # Drizzle schema + DB connection
└── docker/                  # Docker + nginx configs
```

## System Requirements

Before deploying, ensure your server meets the following minimum specifications:

| Requirement | Minimum |
|---|---|
| **OS** | Ubuntu 20.04 / 22.04 / 24.04, Debian 11 / 12, CentOS 7 / 8, Rocky Linux 8 / 9, AlmaLinux 8 / 9, Fedora 38+ |
| **CPU** | 2 cores |
| **RAM** | 2 GB |
| **Disk** | 10 GB |
| **Architecture** | x64 |

---

## Linux — Install Docker

Before deploying, Docker and Docker Compose must be installed on your server.
Use the bundled installer script — it auto-detects your distribution and handles everything:

```bash
git clone https://github.com/Riydx0/cca-PaaS && cd cca-PaaS
sudo bash docker/install-docker.sh
```

The script supports the following distributions:

| Distribution | Versions |
|---|---|
| Ubuntu | 20.04 LTS, 22.04 LTS, 24.04 LTS |
| Debian | 11 (Bullseye), 12 (Bookworm) |
| CentOS | 7, 8 / Stream |
| Rocky Linux | 8, 9 |
| AlmaLinux | 8, 9 |
| Fedora | 38+ |

> **Prefer manual install?** Use these fully self-contained commands:
>
> **Ubuntu / Debian**
> ```bash
> curl -fsSL https://get.docker.com | sudo sh
> sudo usermod -aG docker $USER && newgrp docker
> ```
>
> **CentOS 7**
> ```bash
> sudo yum install -y yum-utils
> sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
> sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
> sudo systemctl enable --now docker && sudo usermod -aG docker $USER
> ```
>
> **Rocky Linux / AlmaLinux / CentOS 8+**
> ```bash
> sudo dnf install -y dnf-plugins-core
> sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
> sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
> sudo systemctl enable --now docker && sudo usermod -aG docker $USER
> ```
>
> **Fedora**
> ```bash
> sudo dnf install -y dnf-plugins-core
> sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
> sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
> sudo systemctl enable --now docker && sudo usermod -aG docker $USER
> ```

After the script completes, **log out and back in** (or run `newgrp docker`) so Docker works without `sudo`.

---

## Quick Deploy (4 steps)

```bash
# 1. Clone the project
git clone https://github.com/Riydx0/cca-PaaS && cd cca-PaaS

# 2. Install Docker (if not already installed)
sudo bash docker/install-docker.sh

# 3. Run the setup script — configures DB password, domain, SSL, then starts Docker automatically
bash docker/setup.sh

# 4. Open the setup wizard in your browser
#    http://your-server-ip/setup
```

The setup script asks for one optional input (a custom DB password — press Enter to auto-generate one), then optionally a domain name, then builds and starts the app with Docker Compose. **No manual file editing required.**

Once the containers are running, open **http://your-server-ip/setup** in your browser to complete the first-run configuration.

---

## First-Run Setup Wizard

When you open `/setup` for the first time, you will be prompted for:

- **Setup Token** — a one-time security token generated at API startup (see below)
- **App URL** — the public URL or IP your app is served from (e.g. `http://your-server-ip`)
- **Admin Name** — your name
- **Admin Email** — the email address for the super admin account
- **Admin Password** — a strong password (minimum 8 characters)

### What is the Setup Token?

The Setup Token is a randomly generated secret that the API server creates on its very first start. It ensures that only someone with server access can complete the initial configuration.

**How to find it:**

```bash
docker compose logs api | grep "Setup Token"
```

You will see a line like:

```
[cca-PaaS] Setup Token: a1b2c3d4e5f6...
```

Copy that value and paste it into the Setup Token field on the `/setup` page.

> **Note:** The token is stored in the database after first use. Once setup is complete, the `/setup` page is no longer accessible.

---

## Admin Setup

After completing the setup wizard, the account you created becomes the **super admin** automatically. You can:

1. Sign in at `http://your-server-ip/sign-in` using the admin credentials you set during setup
2. The **Admin Panel** link will appear in the sidebar

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
SESSION_SECRET=your-random-32-char-secret-here
```

### Install & Run

```bash
# Install dependencies
pnpm install

# Push DB schema
pnpm --filter @workspace/db run db:push

# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend (separate terminal)
pnpm --filter @workspace/cloud-marketplace run dev
```

---

## Billing Module

### Overview

The platform includes a complete billing system with invoices, payment records, and audit logs.

### Data Models

**Invoice** (`invoices` table)
- Tracks billing for users, optionally linked to a server order
- Statuses: `Draft` → `Issued` → `Pending` → `Paid` / `Overdue` / `Cancelled`
- Auto-generates unique invoice numbers (e.g. `INV-LXYZ123-AB4C`)
- Supports SAR and other currencies

**PaymentRecord** (`payment_records` table)
- Records every payment attempt against an invoice
- Statuses: `Pending`, `Completed`, `Failed`, `Refunded`
- Linked to provider name and transaction reference

**AuditLog** (`audit_logs` table)
- Captures all sensitive actions: login, order creation, role change, invoice status change, etc.
- Stores entity type, entity ID, IP address, and JSON details

### Payment Gateway Readiness

The `PaymentGatewayService` provides a pluggable interface for real payment gateways.
Currently operates in mock mode. To connect a real gateway, set the corresponding environment variable:

| Gateway | Environment Variable |
|---|---|
| Moyasar | `MOYASAR_API_KEY` |
| STC Pay | `STC_PAY_API_KEY` |
| HyperPay | `HYPERPAY_ACCESS_TOKEN` |

When the env var is set, the service routes to that provider's API. When unset, it falls back to mock with a warning.

### Audit Log System

The `AuditService` is called automatically on all sensitive events:
- User login (`auth.login`)
- User role change (`user.role_change`)
- Invoice creation (`invoice.create`)
- Invoice marked paid (`invoice.mark_paid`)
- Invoice cancelled (`invoice.cancel`)
- Mock payment processed (`payment.mock_create`)

### Role Permissions

| Action | User | Admin | Super Admin |
|---|---|---|---|
| View own invoices/payments | ✓ | ✓ | ✓ |
| View all invoices/payments | — | ✓ | ✓ |
| View audit logs | — | ✓ | ✓ |
| Mark invoice paid | — | — | ✓ |
| Cancel invoice | — | — | ✓ |
| Create invoice manually | — | — | ✓ |
| Trigger mock payment | — | — | ✓ |

### User Routes
- `GET /api/billing/stats` — Personal billing stats
- `GET /api/billing/invoices` — User's own invoices
- `GET /api/billing/payments` — User's payment history

### Admin Routes
- `GET /api/admin/billing/stats` — Platform-wide financial stats
- `GET /api/admin/invoices` — All invoices (with optional `?status=` filter)
- `GET /api/admin/payments` — All payment records
- `GET /api/admin/audit-logs` — Audit trail

### Super Admin Routes
- `POST /api/admin/invoices` — Create invoice manually
- `POST /api/admin/invoices/:id/mark-paid` — Mark as paid
- `POST /api/admin/invoices/:id/cancel` — Cancel invoice
- `POST /api/admin/invoices/:id/mock-payment` — Simulate payment

---

## Developer

**riyadh alafraa**
