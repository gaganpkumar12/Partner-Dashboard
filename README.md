# Partners Admin Dashboard

A Kanban-style admin dashboard that fetches booking records from Zoho Creator and displays them grouped by partner name. Built with **Convex** (backend + database) and **Vite** (frontend).

## Architecture

- **Convex** — Backend functions (actions, mutations, queries) + real-time database
- **Vite** — Frontend dev server & bundler
- **Zoho Creator API** — Data source (read-only)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Login to Convex (one-time):
   ```
   npx convex login
   ```

3. Start both Convex and Vite dev servers:
   ```
   npx convex dev   # Terminal 1 - backend
   npx vite         # Terminal 2 - frontend
   ```

4. Trigger initial sync from Zoho:
   ```
   npx convex run zohoSync:syncFromZoho
   ```

5. Open **http://localhost:3000**

## Features

- **Real-time Kanban board** — data updates automatically via Convex subscriptions
- **Convex database** — all bookings stored and indexed for fast queries
- **Zoho Creator sync** — fetch records via action, click Refresh or run CLI
- **Status badges** — Up-coming, Work in Progress, Work Finished, etc.
- **Booking count per partner**
- **Search & filter** — by partner name, booking status, empty/with records
- **Detail modal** — click any card to see full booking details
- **Responsive** horizontal scrolling layout

## Convex Functions

| File | Function | Type | Purpose |
|------|----------|------|---------|
| `bookings.ts` | `getBookingsGrouped` | Query | Real-time grouped bookings |
| `bookings.ts` | `getSyncStatus` | Query | Current sync status |
| `zohoSync.ts` | `syncFromZoho` | Action | Fetch from Zoho & store in DB |
| `zohoSync.ts` | `fullResync` | Action | Clear DB & re-fetch everything |
| `mutations.ts` | `upsertBookingBatch` | Mutation | Batch upsert records |

