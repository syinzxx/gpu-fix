# VPS Deployment Guide

This guide walks you through hosting GPU Fix Shop on a cheap Ubuntu VPS so the app is reachable from anywhere — required for the Meta webhook and for tracking links to work on customers' phones.

**Recommended providers:** Hetzner CX22 (~$5/mo), DigitalOcean Droplet, Contabo VPS S.

---

## 1. Server Provisioning

```bash
# SSH into your fresh Ubuntu 22.04 / 24.04 server
ssh root@YOUR_SERVER_IP

# Update packages
apt update && apt upgrade -y

# Install Node.js LTS (v22)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install PM2 (process manager — keeps the app running after reboots)
npm install -g pm2

# Install Caddy (automatic HTTPS reverse proxy)
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Create an app user (don't run as root)
useradd -m -s /bin/bash gpufix
```

---

## 2. Deploy the App

```bash
# Switch to the app user
su - gpufix

# Clone or upload the repo
git clone https://github.com/YOUR_USERNAME/gpu-fix-shop.git app
cd app

# Install dependencies
npm ci

# Copy and fill in environment variables
cp .env .env.production
nano .env.production
```

Set these values in `.env.production`:

```env
DATABASE_URL="file:/home/gpufix/app/prisma/prod.db"
AUTH_SECRET="<generate with: openssl rand -hex 32>"
AUTH_TRUST_HOST=true

WHATSAPP_PHONE_NUMBER_ID="your-id"
WHATSAPP_ACCESS_TOKEN="your-permanent-token"
WHATSAPP_VERIFY_TOKEN="gpu-fix-verify-2026"

NEXT_PUBLIC_APP_URL="https://your-domain.com"
SHOP_NAME="GPU Fix Shop"
SHOP_PHONE="+20XXXXXXXXXX"
SHOP_ADDRESS="Your address"
```

```bash
# Apply the database schema
DATABASE_URL="file:/home/gpufix/app/prisma/prod.db" npx prisma db push

# Seed the first admin user
DATABASE_URL="file:/home/gpufix/app/prisma/prod.db" npm run db:seed

# Build the Next.js app
NODE_ENV=production npm run build

# Start with PM2.
# Note: `next start` runs with NODE_ENV=production automatically, and Next.js
# then auto-loads .env.production from the project root — no PM2 --env flag
# is needed (PM2's --env only selects env blocks from an ecosystem file).
pm2 start npm --name gpu-fix-shop -- run start

# Save PM2 process list so it restarts on reboot
pm2 save

# Enable PM2 startup on boot (run as root)
exit  # back to root
pm2 startup systemd -u gpufix --hp /home/gpufix
systemctl enable pm2-gpufix
```

---

## 3. Configure Caddy (Automatic HTTPS)

Point your domain's DNS A record at the server IP first, then:

```bash
# Edit the Caddyfile
nano /etc/caddy/Caddyfile
```

Replace the contents with:

```caddy
your-domain.com {
    reverse_proxy localhost:3000
}
```

```bash
# Reload Caddy — it automatically obtains a Let's Encrypt certificate
systemctl reload caddy
```

Your app is now live at `https://your-domain.com` with automatic HTTPS.

---

## 4. Configure the Meta Webhook

1. Go to your Meta developer app → **WhatsApp → Configuration → Webhook**.
2. Set:
   - **Callback URL**: `https://your-domain.com/api/whatsapp/webhook`
   - **Verify token**: `gpu-fix-verify-2026`
3. Click **Verify and save**.
4. Subscribe to the **messages** webhook field.

---

## 5. Configure the Electron Desktop App

Open the desktop app and in the setup screen enter:

```
https://your-domain.com
```

Staff now access the live app from the desktop client on the shop counter PC. Messages sent from the app update the hosted database — accessible from any browser or the desktop app simultaneously.

---

## 6. Routine Maintenance

```bash
# View live logs
pm2 logs gpu-fix-shop

# Restart after a code update
su - gpufix
cd app
git pull
npm ci
NODE_ENV=production npm run build
pm2 restart gpu-fix-shop

# Database backup (run as gpufix user, e.g. via cron daily)
cp /home/gpufix/app/prisma/prod.db \
   /home/gpufix/backups/prod-$(date +%Y%m%d).db
```

---

## Optional: Switch to PostgreSQL

If the shop grows and SQLite becomes a bottleneck:

1. Install PostgreSQL on the server or use a managed DB (Neon, Supabase).
2. In `prisma/schema.prisma`, change `provider = "sqlite"` → `"postgresql"`.
3. Set `DATABASE_URL` to the PostgreSQL connection string.
4. Run `npx prisma db push` — the schema is compatible.
