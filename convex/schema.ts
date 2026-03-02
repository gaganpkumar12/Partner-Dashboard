import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Store each booking record from Zoho Creator
  bookings: defineTable({
    zohoId: v.string(),              // Zoho record ID
    partnerName: v.string(),          // Partner_Name
    status: v.string(),               // Blueprint current stage display value
    statusRaw: v.string(),            // Full status string
    adminNote: v.string(),            // Admin_Note
    phoneNumber: v.string(),          // Phone_Number
    addedTime: v.string(),            // Added_Time
    rating: v.string(),               // Rating
    beforePhotos: v.array(v.string()),// Before_Photos URLs
    reachedSelfie: v.array(v.string()),
    feedbackImages: v.array(v.string()),
    lunchCheckoutVideo: v.optional(v.string()),   // Lunch_Time_Check_Out_Video URL
    rawData: v.string(),              // Full JSON for modal display
  })
    .index("by_partner", ["partnerName"])
    .index("by_zohoId", ["zohoId"])
    .index("by_status", ["status"]),

  // Store job records from All_Jobs1 report (linked to bookings via Booking_ID)
  jobs: defineTable({
    zohoId: v.string(),               // Job record ID
    bookingId: v.string(),            // Booking_ID (links to bookings.zohoId)
    portalUsers: v.string(),          // Portal_Users (partner name)
    adminNote: v.string(),            // Admin_Note
    paymentMode: v.string(),          // Payment_Mode
    amount: v.string(),               // Amount
    addedTime: v.string(),            // Added_Time
    addedUser: v.string(),            // Added_User
    afterPhotos: v.array(v.string()), // After_Photos URLs
    feedbackImages: v.array(v.string()), // Feedback_Form_2_Image URLs
    paymentProofPhotos: v.array(v.string()), // Payment_Proof_Photo URLs
    eveningCheckoutVideo: v.string(), // Evening_Check_out_Video URL
    addOns: v.string(),               // Add_ons JSON
    rawData: v.string(),              // Full JSON
  })
    .index("by_bookingId", ["bookingId"])
    .index("by_zohoId", ["zohoId"]),

  // Store sync metadata
  syncStatus: defineTable({
    lastSyncTime: v.number(),
    totalRecords: v.number(),
    status: v.string(),               // "syncing" | "success" | "error"
    errorMessage: v.optional(v.string()),
  }),

  // Cache Zoho access tokens to avoid rate limits
  tokenCache: defineTable({
    accessToken: v.string(),
    expiresAt: v.number(),  // timestamp ms
  }),
});
