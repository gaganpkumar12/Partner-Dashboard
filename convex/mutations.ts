import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

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
