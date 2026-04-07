# cca-PaaS — Cloud Services Marketplace

A premium B2B cloud infrastructure marketplace that lets enterprises browse, compare, and provision cloud servers from multiple providers through a single unified platform.

**Version:** v1.2.0 · **OS:** Ubuntu 20.04 / 22.04 / 24.04 · **Architecture:** x64

---

## Features

- Multi-provider service catalog (Contabo, Google Cloud, Alibaba Cloud, Huawei Cloud)
- Secure authentication with role-based access control (no third-party auth)
- Real-time dashboard — active services, pending deployments, revenue stats
- Full order lifecycle management (Pending → Provisioning → Active / Failed)
- Admin Panel — user management, service CRUD, billing, audit logs, system updates
- English + Arabic with full RTL layout support
- Mobile, tablet, and desktop responsive UI

---

## Requirements

| | Minimum |
|---|---|
| OS | Ubuntu 20.04 / 22.04 / 24.04 |
| CPU | 2 cores |
| RAM | 2 GB |
| Disk | 10 GB |

---

## Step 1 — Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

---

## Step 2 — Clone & Setup

```bash
git clone https://github.com/Riydx0/cca-PaaS && cd cca-PaaS
bash docker/setup.sh
```

The setup script will guide you through the configuration. Choose your scenario below:

---

## Scenario A — Without Cloudflare

Use this if you are accessing the server by IP, or have a domain pointed directly to your server (no Cloudflare proxy).

When the setup script asks about SSL, choose:
- **Let's Encrypt** — if you have a domain with DNS pointing to this server
- **No SSL (HTTP only)** — if using a plain IP address

After setup completes, open your browser:
```
http://your-server-ip/setup
```
or
```
https://yourdomain.com/setup
```

---

## Scenario B — With Cloudflare (Recommended for production)

Use this if your domain's DNS is managed by Cloudflare with the proxy (orange cloud ☁️) enabled.

When the setup script asks about SSL, choose **Cloudflare → Flexible**.

After setup completes:
1. Go to **Cloudflare Dashboard → yourdomain.com → SSL/TLS → Overview**
2. Set SSL mode to **Flexible**
3. Open your browser: `https://yourdomain.com/setup`

> **Want Full SSL (encrypted connection between Cloudflare and your server)?**
>
> After the initial setup is complete, run:
> ```bash
> bash docker/setup-cloudflare-ssl.sh
> ```
> The script will guide you to create a free Cloudflare Origin Certificate and install it automatically.
> After it finishes, set Cloudflare SSL/TLS to **Full**.

---

## Step 3 — Complete the Setup Wizard

When you open `/setup` for the first time, you will need a **Setup Token**.

Get it from the server:
```bash
docker compose logs api | grep "Setup Token"
```

You will see a line like:
```
[cca-PaaS] Setup Token: a1b2c3d4e5f6...
```

Fill in your admin name, email, and password — then submit. The setup page is permanently disabled after first use.

---

## Updating

### From the Admin Panel (recommended)
Admin Panel → System Updates → **Check for Updates** → **Run Update**

### From the server
```bash
cd ~/cca-PaaS
git pull origin main
docker compose up -d --build api
```

---

## Backup & Restore

**Backup:**
```bash
docker compose exec db pg_dump -U postgres cca_paas > backup.sql
```

**Restore:**
```bash
docker compose exec -T db psql -U postgres cca_paas < backup.sql
```

---

## Reinstall (keep existing data)

```bash
# 1. Save your configuration
cp ~/cca-PaaS/.env ~/env-backup.txt

# 2. Stop containers WITHOUT deleting volumes
cd ~/cca-PaaS && docker compose down

# 3. Delete and re-clone
cd ~ && rm -rf cca-PaaS
git clone https://github.com/Riydx0/cca-PaaS && cd cca-PaaS

# 4. Restore configuration
cp ~/env-backup.txt .env

# 5. Start
docker compose up -d --build
```

> ⚠️ Never run `docker compose down -v` — the `-v` flag permanently deletes all data.

---

## Troubleshooting

### Cloudflare Error 521 (Web server is down)
Cloudflare cannot reach your server. Check:

1. All containers are running:
   ```bash
   docker compose ps
   ```
2. Your Cloudflare SSL mode matches your setup:
   - No SSL cert on server → set Cloudflare to **Flexible**
   - Cert installed via `setup-cloudflare-ssl.sh` → set to **Full**

### Cannot connect to API server
The API container may be restarting (common after running an update from the Admin Panel):
```bash
cd ~/cca-PaaS && docker compose up -d api
```
Wait 30 seconds, then refresh the page.

### View logs
```bash
docker compose logs api --tail=50
docker compose logs frontend --tail=50
```

---

## Local Development

**Requirements:** Node.js 20+, pnpm 9+, PostgreSQL 15+

```bash
# Install dependencies
pnpm install

# Create .env
echo "DATABASE_URL=postgresql://user:password@localhost:5432/cca_paas" > .env
echo "SESSION_SECRET=your-random-32-char-secret" >> .env

# Push DB schema
pnpm --filter @workspace/db run db:push

# Start API
pnpm --filter @workspace/api-server run dev

# Start frontend (new terminal)
pnpm --filter @workspace/cloud-marketplace run dev
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Auth | express-session + bcrypt + PostgreSQL |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL 16 + Drizzle ORM |
| Hosting | Docker + nginx |

---

## Developer

**riyadh alafraa**
