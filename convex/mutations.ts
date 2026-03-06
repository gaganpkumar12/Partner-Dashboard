import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Clear ALL data from every table ─────────────────────────
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["bookings", "jobs", "syncStatus", "tokenCache"] as const;
    let total = 0;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        total++;
      }
    }
    return { deleted: total };
  },
});

// Upsert a single booking record
export const upsertBooking = internalMutation({
  args: {
    zohoId: v.string(),
    partnerName: v.string(),
    status: v.string(),
    statusRaw: v.string(),
    adminNote: v.string(),
    phoneNumber: v.string(),
    addedTime: v.string(),
    rating: v.string(),
    beforePhotos: v.array(v.string()),
    reachedSelfie: v.array(v.string()),
    feedbackImages: v.array(v.string()),
    lunchCheckoutVideo: v.string(),
    rawData: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if booking already exists
    const existing = await ctx.db
      .query("bookings")
      .withIndex("by_zohoId", (q) => q.eq("zohoId", args.zohoId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        partnerName: args.partnerName,
        status: args.status,
        statusRaw: args.statusRaw,
        adminNote: args.adminNote,
        phoneNumber: args.phoneNumber,
        addedTime: args.addedTime,
        rating: args.rating,
        beforePhotos: args.beforePhotos,
        reachedSelfie: args.reachedSelfie,
        feedbackImages: args.feedbackImages,
        lunchCheckoutVideo: args.lunchCheckoutVideo,
        rawData: args.rawData,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("bookings", args);
    }
  },
});

// Batch upsert bookings (called from action in chunks)
export const upsertBookingBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        zohoId: v.string(),
        partnerName: v.string(),
        status: v.string(),
        statusRaw: v.string(),
        adminNote: v.string(),
        phoneNumber: v.string(),
        addedTime: v.string(),
        rating: v.string(),
        beforePhotos: v.array(v.string()),
        reachedSelfie: v.array(v.string()),
        feedbackImages: v.array(v.string()),
        lunchCheckoutVideo: v.string(),
        rawData: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let upserted = 0;
    for (const record of args.records) {
      const existing = await ctx.db
        .query("bookings")
        .withIndex("by_zohoId", (q) => q.eq("zohoId", record.zohoId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          partnerName: record.partnerName,
          status: record.status,
          statusRaw: record.statusRaw,
          adminNote: record.adminNote,
          phoneNumber: record.phoneNumber,
          addedTime: record.addedTime,
          rating: record.rating,
          beforePhotos: record.beforePhotos,
          reachedSelfie: record.reachedSelfie,
          feedbackImages: record.feedbackImages,
          lunchCheckoutVideo: record.lunchCheckoutVideo,
          rawData: record.rawData,
        });
      } else {
        await ctx.db.insert("bookings", record);
      }
      upserted++;
    }
    return upserted;
  },
});

// Update sync status
export const updateSyncStatus = internalMutation({
  args: {
    totalRecords: v.number(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Remove old sync status entries
    const existing = await ctx.db.query("syncStatus").collect();
    for (const entry of existing) {
      await ctx.db.delete(entry._id);
    }

    return await ctx.db.insert("syncStatus", {
      lastSyncTime: Date.now(),
      totalRecords: args.totalRecords,
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

// Clear all bookings (for full re-sync)
export const clearAllBookings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allBookings = await ctx.db.query("bookings").collect();
    for (const booking of allBookings) {
      await ctx.db.delete(booking._id);
    }
    return allBookings.length;
  },
});

// Clear all bookings and jobs for a specific partner (for profile reset)
export const clearPartnerData = internalMutation({
  args: { partnerName: v.string() },
  handler: async (ctx, args) => {
    // Delete bookings for this partner
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_partner", (q) => q.eq("partnerName", args.partnerName))
      .collect();
    const bookingZohoIds = new Set(bookings.map((b) => b.zohoId));
    for (const booking of bookings) {
      await ctx.db.delete(booking._id);
    }

    // Delete jobs linked to those bookings
    let jobsDeleted = 0;
    const allJobs = await ctx.db.query("jobs").collect();
    for (const job of allJobs) {
      if (
        bookingZohoIds.has(job.bookingId) ||
        job.portalUsers.trim().toLowerCase() === args.partnerName.toLowerCase()
      ) {
        await ctx.db.delete(job._id);
        jobsDeleted++;
      }
    }

    return { bookingsDeleted: bookings.length, jobsDeleted };
  },
});

// ─── Jobs Mutations ───────────────────────────────────────────

// Batch upsert job records
export const upsertJobBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        zohoId: v.string(),
        bookingId: v.string(),
        portalUsers: v.string(),
        adminNote: v.string(),
        paymentMode: v.string(),
        amount: v.string(),
        addedTime: v.string(),
        addedUser: v.string(),
        afterPhotos: v.array(v.string()),
        feedbackImages: v.array(v.string()),
        paymentProofPhotos: v.array(v.string()),
        googleReviewPhotos: v.optional(v.array(v.string())),
        eveningCheckoutVideo: v.string(),
        addOns: v.string(),
        rawData: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let upserted = 0;
    for (const record of args.records) {
      const existing = await ctx.db
        .query("jobs")
        .withIndex("by_zohoId", (q) => q.eq("zohoId", record.zohoId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          bookingId: record.bookingId,
          portalUsers: record.portalUsers,
          adminNote: record.adminNote,
          paymentMode: record.paymentMode,
          amount: record.amount,
          addedTime: record.addedTime,
          addedUser: record.addedUser,
          afterPhotos: record.afterPhotos,
          feedbackImages: record.feedbackImages,
          paymentProofPhotos: record.paymentProofPhotos,
          googleReviewPhotos: record.googleReviewPhotos,
          eveningCheckoutVideo: record.eveningCheckoutVideo,
          addOns: record.addOns,
          rawData: record.rawData,
        });
      } else {
        await ctx.db.insert("jobs", record);
      }
      upserted++;
    }
    return upserted;
  },
});

// Clear all jobs (for full re-sync)
export const clearAllJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allJobs = await ctx.db.query("jobs").collect();
    for (const job of allJobs) {
      await ctx.db.delete(job._id);
    }
    return allJobs.length;
  },
});

// ─── Token Cache ──────────────────────────────────────────────

// Get cached token (returns null if expired or not found)
export const getCachedToken = internalMutation({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("tokenCache").collect();
    if (entries.length === 0) return null;
    const entry = entries[entries.length - 1];
    // Return token if not expired (with 60s buffer)
    if (entry.expiresAt > Date.now() + 60000) {
      return entry.accessToken;
    }
    return null;
  },
});

// Store a new token in the cache
export const setCachedToken = internalMutation({
  args: { accessToken: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    // Clear old entries
    const existing = await ctx.db.query("tokenCache").collect();
    for (const entry of existing) {
      await ctx.db.delete(entry._id);
    }
    await ctx.db.insert("tokenCache", {
      accessToken: args.accessToken,
      expiresAt: args.expiresAt,
    });
  },
});

// ─── Sync Quota (server-enforced 2/day) ───────────────────────

// Returns today's date string in IST (UTC+5:30)
function todayIST(): string {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const DAILY_SYNC_LIMIT = 2;

// Get current quota for today (public query — used by client)
export const getSyncQuota = mutation({
  args: {},
  handler: async (ctx) => {
    const today = todayIST();
    const row = await ctx.db
      .query("syncQuota")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();
    const used = row?.count ?? 0;
    return { used, remaining: Math.max(0, DAILY_SYNC_LIMIT - used), limit: DAILY_SYNC_LIMIT };
  },
});

// Attempt to consume one quota slot — throws if limit reached
export const checkAndIncrementSyncQuota = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = todayIST();
    const row = await ctx.db
      .query("syncQuota")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();
    const used = row?.count ?? 0;
    if (used >= DAILY_SYNC_LIMIT) {
      throw new Error(`Daily sync limit reached (${DAILY_SYNC_LIMIT}/day). Resets at midnight IST.`);
    }
    if (row) {
      await ctx.db.patch(row._id, { count: used + 1 });
    } else {
      await ctx.db.insert("syncQuota", { date: today, count: 1 });
    }
    return { used: used + 1, remaining: DAILY_SYNC_LIMIT - (used + 1) };
  },
});
