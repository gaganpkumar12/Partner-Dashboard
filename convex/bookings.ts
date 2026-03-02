import { query } from "./_generated/server";
import { v } from "convex/values";

// Partners list constant
export const PARTNERS = [
  "ASLAM", "MUNNA", "NASIR KHAN", "DULAL KHAN", "KOHLI",
  "ALAMGIR MONDAL", "Sujan", "Vishal", "Shamim Khan", "Masum old",
  "Maharaj", "Forkan", "GOUSE", "Md. Rajib", "Saidul Babu",
  "Md Tuhin", "Usuf", "Jamal", "Sojib", "Suman",
  "Ridoy", "BK - Rameez", "Bilal Hussain", "Md. Raju", "BK - Rafikul",
  "Melon Rizwan", "BK - Babu Reddy", "Sukumar", "Rahim",
  "Maxwillam Narzary", "Bahadur Khan", "Quem", "Mizan", "Sameer",
  "Farhan Ahmed", "Bilal", "Mijan New", "Yunus Khan", "Bilal Mk",
  "Hirendra", "Sahin", "Salim", "Rofikul Islam", "Salim 2",
  "Michu laskar", "Sohag Khan", "Hasib", "Abdul Kalam",
  "Kausik Barman", "Hirak Mondal", "Munir Khan BK", "BK - Rubel",
  "Sagar khan", "BK - Beelal", "Abdur Rahim", "zakir",
  "Mehadi Hasan", "Hasan New", "Umesh", "Abir", "BK - Nasim",
  "Ranjith", "Nilesh", "Sohel", "BK - Nasir Sheikh",
  "Masum Howldar", "Rana Khan", "BK - Riyazul", "shiva",
  "Alameen old FHC", "Rishu", "Zamal Khan", "BK - Ebadul",
  "Kuddus", "Rajibul", "Jakir Hussian2", "Alameen Bk New",
  "Sameer Team", "Alamin new FHC", "zakir hussain",
];

// Get all bookings grouped by partner (real-time reactive query)
export const getBookingsGrouped = query({
  args: {},
  handler: async (ctx) => {
    const allBookings = await ctx.db.query("bookings").collect();

    // Group by partner name
    const grouped: Record<string, any[]> = {};

    // Initialize all known partners
    for (const partner of PARTNERS) {
      grouped[partner] = [];
    }

    let unmatchedCount = 0;

    for (const booking of allBookings) {
      const pName = booking.partnerName.trim();

      if (grouped[pName] !== undefined) {
        grouped[pName].push(booking);
      } else {
        // Case-insensitive match
        const matched = PARTNERS.find(
          (p) => p.toLowerCase() === pName.toLowerCase()
        );
        if (matched) {
          grouped[matched].push(booking);
        } else if (pName) {
          // Unknown partner - create bucket
          if (!grouped[pName]) grouped[pName] = [];
          grouped[pName].push(booking);
          unmatchedCount++;
        } else {
          if (!grouped["_Unassigned"]) grouped["_Unassigned"] = [];
          grouped["_Unassigned"].push(booking);
        }
      }
    }

    return {
      total: allBookings.length,
      grouped,
    };
  },
});

// Get bookings for a specific partner
export const getBookingsByPartner = query({
  args: { partnerName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_partner", (q) => q.eq("partnerName", args.partnerName))
      .collect();
  },
});

// Get sync status
export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const statuses = await ctx.db.query("syncStatus").collect();
    return statuses.length > 0 ? statuses[statuses.length - 1] : null;
  },
});

// Get partners list
export const getPartners = query({
  args: {},
  handler: async () => {
    return PARTNERS;
  },
});

// Get jobs for a specific booking (by zohoId)
export const getJobsByBookingId = query({
  args: { bookingId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
      .collect();
  },
});
