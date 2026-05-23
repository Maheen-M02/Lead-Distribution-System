# Prowider — Mini Lead Distribution System

A full-stack lead generation and distribution platform built with Next.js, PostgreSQL, and Server-Sent Events.

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Database**: PostgreSQL via Prisma ORM
- **Real-time**: Server-Sent Events (SSE)
- **Language**: TypeScript

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or hosted: Supabase, Neon, Railway, etc.)

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/prowider
cd prowider
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 3. Initialize Database

```bash
# Push schema to database
npm run db:push

# Seed with services and providers
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy

Works on Vercel (with any PostgreSQL-compatible hosted DB):
```bash
vercel --prod
```

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/request-service` | Public customer lead form |
| `/dashboard` | Real-time provider dashboard |
| `/test-tools` | Webhook simulation & testing panel |

---

## Allocation Algorithm

### Mandatory Assignments
Every lead is first assigned to mandatory providers based on service:
- **Service 1** → Provider 1 (always)
- **Service 2** → Provider 5 (always)
- **Service 3** → Provider 1 AND Provider 4 (always)

### Fair Distribution (Round-Robin)
After mandatory slots, remaining slots (up to 3 total) are filled from a service-specific pool:
- **Service 1 pool**: Providers 2, 3, 4
- **Service 2 pool**: Providers 6, 7, 8
- **Service 3 pool**: Providers 2, 3, 5, 6, 7, 8

The system maintains a persistent `AllocationState` table with a `nextIndex` per service. Each lead advances the index, ensuring providers are selected in rotation — not randomly. This state survives server restarts.

**Example for Service 1:**
- Lead 1 → Provider 1 (mandatory) + Provider 2 (pool index 0) + Provider 3 (pool index 1)
- Lead 2 → Provider 1 (mandatory) + Provider 3 (pool index 1) + Provider 4 (pool index 2)
- Lead 3 → Provider 1 (mandatory) + Provider 4 (pool index 2) + Provider 2 (pool index 0)

Providers at monthly quota (10 leads) are skipped automatically.

---

## Concurrency Handling

All lead allocations run inside a **PostgreSQL serializable transaction** (`IsolationLevel.Serializable`). This prevents:
- Double assignment of the same provider to concurrent leads
- Quota over-counting under simultaneous requests
- Allocation index drift from race conditions

If two leads are created simultaneously, PostgreSQL will serialize them — one will complete first, the other will retry automatically.

---

## Webhook Idempotency

The `/api/webhook` endpoint uses an **event ID-based deduplication** strategy:

1. Client sends a unique `eventId` with every webhook call
2. The endpoint looks up `WebhookEvent` table for that ID
3. If found → return "already processed" without side effects
4. If not found → process the event, then insert the event ID record atomically

This guarantees that calling the same webhook N times has identical effect to calling it once.

---

## Real-time Updates

Server-Sent Events (SSE) are used for real-time dashboard updates:
1. Dashboard connects to `/api/sse` on load
2. Server keeps the connection alive with 25s heartbeats
3. When a lead is created, `broadcastUpdate()` pushes a `new-lead` event to all connected clients
4. Dashboard re-fetches provider data and highlights newly assigned providers for 5 seconds

---

## Database Schema

```
Service         — id, name
Provider        — id, name, monthlyQuota, leadsReceivedCount, allocationIndex
Lead            — id, customerName, phone, city, description, serviceId
                  UNIQUE(phone, serviceId)
LeadAssignment  — id, leadId, providerId
                  UNIQUE(leadId, providerId)
AllocationState — id, serviceId UNIQUE, nextIndex
WebhookEvent    — id (eventId), eventType, processedAt
QuotaReset      — id, providerId, resetAt
```
