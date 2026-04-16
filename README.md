# SparkleClean Pro API

> Enterprise cleaning platform — Australia-optimised | NestJS + Prisma + Postgres + Redis

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/navyapdh11/sparkleclean-api)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Next.js Frontend (Vercel)           │
│         3D Glassmorphism UI + Booking Flow       │
└──────────────────────┬──────────────────────────┘
                       │ HTTP / REST
┌──────────────────────▼──────────────────────────┐
│           NestJS API (Render / Docker)           │
│                                                  │
│  ┌──────┐ ┌────────┐ ┌────────┐ ┌────────────┐ │
│  │ Auth │ │Booking │ │Pricing │ │  Payments  │ │
│  └──┬───┘ └───┬────┘ └───┬────┘ └─────┬──────┘ │
│     │         │           │             │        │
│  ┌──▼───┐ ┌───▼────┐ ┌───▼────┐ ┌─────▼──────┐ │
│  │ Geo  │ │Cleaner │ │ Admin  │ │   Xero     │ │
│  │(PostGIS)│Assign  │ │Dashboard│ │  Invoice   │ │
│  └──────┘ └────────┘ └────────┘ └────────────┘ │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Content/SEO │  │  Webhook (BullMQ+Redis)  │ │
│  │  + AI/RAG    │  │  — Exponential backoff    │ │
│  └──────────────┘  └──────────────────────────┘ │
└──────────┬────────────────────┬──────────────────┘
           │                    │
    ┌──────▼──────┐     ┌───────▼────────┐
    │  PostgreSQL │     │     Redis       │
    │  + PostGIS  │     │  (BullMQ)       │
    └─────────────┘     └────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node 22, TypeScript |
| **Framework** | NestJS 11 |
| **ORM** | Prisma 6 (PostgreSQL + PostGIS) |
| **Queue** | BullMQ 5 (Redis) |
| **Payments** | Stripe (PaymentIntents + Webhooks) |
| **Accounting** | Xero (OAuth2, invoice sync) |
| **AI** | OpenAI (content generation, human-approval gated) |
| **API Docs** | Swagger / OpenAPI 3.0 |
| **Auth** | JWT + Passport + RBAC guards |
| **Deploy** | Docker → Render (Postgres + Redis + Web) |

## Features

### Phase 2 — Core Platform
- **Authentication** — JWT login/register, `JwtAuthGuard`, role-based access (`CUSTOMER`, `CLEANER`, `ADMIN`, `SUPER_ADMIN`, `AGENT`)
- **Booking Engine** — Create/cancel bookings, recurring generation (weekly/fortnightly/monthly), GST-inclusive AUD pricing
- **Pricing Engine** — Dynamic per-service pricing with per-bedroom/bathroom/area surcharges, frequency discounts (20% weekly → 10% monthly), minimum charges
- **Geo Service** — PostGIS suburb search, SEO slug lookups, cleaner matching by service radius
- **Content/SEO** — Published pages, FAQ endpoints, AI-generated suburb landing pages (requires human approval per OASIS-IS governance)
- **Webhook System** — Event publishing to audit log + BullMQ delivery with HMAC-SHA256 signing and 5-attempt exponential backoff

### Phase 3 — Payments, Accounting & Admin
- **Stripe Integration** — PaymentIntent creation, confirm/refund, webhook handler with signature verification, auto-invoice on payment
- **Xero Sync** — Contact find/create, invoice creation with AU GST line items, payment sync, 15-minute cron for pending invoices
- **Cleaner Assignment** — 4-factor scoring (proximity 40pts, availability 30pts, load balance 20pts, rating 10pts), 5-minute auto-assign cron, manual override API
- **Admin Dashboard** — 30-day overview stats (bookings, revenue, completion rate, avg rating), filtered booking list, user management, MTD revenue + growth %, cleaner performance leaderboard

## Quick Start

### Prerequisites
- Node 22+
- PostgreSQL 16+ with PostGIS extension
- Redis 6+

### 1. Install & Setup

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and other keys

# Generate Prisma client + run migrations
npx prisma generate
npx prisma migrate dev

# Seed demo data (15 Perth suburbs, 8 services, pricing rules)
npx prisma db seed
```

### 2. Run

```bash
# Development (watch mode)
pnpm start:dev

# Production
pnpm build
pnpm start:prod
```

### 3. Explore

| URL | Description |
|-----|-------------|
| `http://localhost:3001/api/docs` | Swagger UI (interactive API explorer) |
| `http://localhost:3001/health` | Health check (DB connectivity) |
| `http://localhost:3001/` | API info (name, version, links) |

## Deploy to Render (One-Click)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/navyapdh11/sparkleclean-api)

The `render.yaml` blueprint provisions:
- **PostgreSQL 16** (free tier, 1GB)
- **Redis** (free tier)
- **Web Service** (Docker build, free tier)

After deploy completes, run in the Render shell:
```bash
npx prisma migrate deploy
npx prisma db seed
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Login with email + password |
| `POST` | `/auth/register` | Register customer account |
| `GET` | `/auth/me` | Get current user profile |

### Bookings
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bookings` | Create booking (with recurring support) |
| `GET` | `/bookings/:id` | Get booking details |
| `POST` | `/bookings/:id/cancel` | Cancel booking |

### Pricing
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pricing/services` | List all services |
| `GET` | `/pricing/quote?serviceId=&propertyId=&frequency=` | Get price quote |
| `GET` | `/pricing/rules/:serviceId` | Get pricing rules |

### Payments
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/payments` | Create Stripe PaymentIntent |
| `POST` | `/payments/:id/refund` | Refund (full/partial) |
| `POST` | `/payments/webhook/stripe` | Stripe webhook handler |

### Geo
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/geo/suburbs?q=perth&state=WA` | Search suburbs |
| `GET` | `/geo/suburbs/:slug` | Get suburb SEO data |
| `GET` | `/geo/cleaners/:suburbId` | Find cleaners in area |
| `GET` | `/geo/coverage` | Service coverage by state |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/dashboard` | 30-day overview stats |
| `GET` | `/admin/bookings` | Filtered booking list |
| `POST` | `/admin/bookings/:id/status` | Update booking status |
| `GET` | `/admin/users` | User management |
| `GET` | `/admin/metrics/revenue` | MTD revenue + growth |
| `GET` | `/admin/metrics/cleaners` | Cleaner performance leaderboard |

### Content
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/content/pages/:slug` | Get published page |
| `GET` | `/content/faqs` | Get all FAQs |
| `POST` | `/content/suburb-pages/generate` | Generate suburb page (draft) |

## Database Schema

18 models: `User`, `Customer`, `Cleaner`, `AdminProfile`, `Permission`, `Property`, `Suburb`, `Service`, `PricingRule`, `Booking`, `BookingAssignment`, `Payment`, `Invoice`, `Review`, `ContentPage`, `AgentConfig`, `AuditLog`, `ApiKey`, `WebhookEndpoint`, `WebhookDelivery`

Full schema: [`prisma/schema.prisma`](prisma/schema.prisma)

## Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| Every 5 min | Auto-assign cleaners | Scores and assigns best available cleaner to unassigned bookings |
| Every 15 min | Sync invoices to Xero | Pushes unsynced invoices to Xero accounting |

## Seed Data

```bash
npx prisma db seed
```

Creates:
- 15 Perth metro suburbs
- 8 cleaning services (Regular, Deep, End of Lease, Commercial, Carpet, Window, Oven, Fridge)
- Pricing rules (ONCE/WEEKLY/FORTNIGHTLY/MONTHLY)
- 4 OASIS-IS agent configurations (SEO, Support, Route Optimizer, Revenue)
- Admin user: `admin@sparkleclean.com.au`
- Test customer: `test@example.com.au`

## License

Private — SparkleClean Pro
