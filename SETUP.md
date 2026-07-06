# Gala Mandi Shop Management — Setup Guide

## 1. Prerequisites
- Node.js 18+
- PostgreSQL database (use [Neon](https://neon.tech) for free hosting)
- Vercel account for deployment

## 2. Database Setup (Neon — Free)
1. Sign up at https://neon.tech
2. Create a new project: **gala-mandi**
3. Copy the connection string (looks like: `postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require`)

## 3. Local Setup
```bash
# Clone/open project
cd gala-mandi

# Install dependencies
npm install

# Copy environment file
copy .env.example .env
```

Edit `.env` and paste your Neon database URL:
```
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require"
AUTH_SECRET="change-this-to-a-random-secret-string"
AUTH_URL="http://localhost:3000"
```

## 4. Initialize Database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates all tables)
npm run db:push

# Seed with sample data
npm run db:seed
```

## 5. Run Locally
```bash
npm run dev
```
Open http://localhost:3000

## 6. Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# DATABASE_URL = your Neon connection string
# AUTH_SECRET  = random secret (generate with: openssl rand -base64 32)
# AUTH_URL     = https://your-app.vercel.app
```

## Default Login Credentials
| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | admin@galamandi.com | admin123 | Super Admin |
| Manager | manager@galamandi.com | manager123 | Manager |
| Cashier | cashier@galamandi.com | cashier123 | Cashier |

**Important: Change all passwords immediately after first login!**

## Modules
| Module | Description |
|--------|-------------|
| Dashboard | Sales stats, charts, quick overview |
| Inventory | Products, stock levels, categories |
| Sales | Create sales, track payments (udhar) |
| Purchases | Purchase orders, supplier tracking |
| Pesticides | Pesticide stock, expiry alerts, sales |
| Finance | Income/expense ledger, balance sheet |
| Tasks | Assign tasks to users with due dates |
| Reports | Monthly charts, analytics |
| Audit Log | Full activity trail |
| Users | Multi-user with role-based access |
| Settings | Categories configuration |
