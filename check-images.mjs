// Quick script to check what the image fields look like in raw Zoho data
import { ConvexClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

const client = new ConvexClient(process.env.VITE_CONVEX_URL || "https://benevolent-jellyfish-177.eu-west-1.convex.cloud");

async function check() {
  const bookings = await client.query(api.bookings.getBookingsByPartner, { partnerName: "Abir" });
  
  for (const b of bookings.slice(0, 3)) {
    console.log("=== Booking", b.zohoId, "===");
    console.log("beforePhotos:", JSON.stringify(b.beforePhotos));
    console.log("reachedSelfie:", JSON.stringify(b.reachedSelfie));
    console.log("feedbackImages:", JSON.stringify(b.feedbackImages));
    
    // Check rawData for image fields
    const raw = JSON.parse(b.rawData);
    console.log("Raw Before_Photos:", JSON.stringify(raw.Before_Photos));
    console.log("Raw Reached_Selfie:", JSON.stringify(raw.Reached_Selfie));
    console.log("Raw Feedback_Form_1_Image:", JSON.stringify(raw.Feedback_Form_1_Image));
    console.log("");
  }
  
  // Find any record with non-empty photos
  const allData = await client.query(api.bookings.getBookingsGrouped, {});
  let foundWithPhotos = 0;
  for (const [partner, records] of Object.entries(allData.grouped)) {
    for (const r of records) {
      if (r.beforePhotos?.length > 0 || r.reachedSelfie?.length > 0 || r.feedbackImages?.length > 0) {
        foundWithPhotos++;
        if (foundWithPhotos <= 3) {
          console.log(`\n=== WITH PHOTOS: ${partner} / ${r.zohoId} ===`);
          console.log("beforePhotos:", JSON.stringify(r.beforePhotos));
          console.log("reachedSelfie:", JSON.stringify(r.reachedSelfie));
          console.log("feedbackImages:", JSON.stringify(r.feedbackImages));
        }
      }
    }
  }
  console.log(`\nTotal records with any photos: ${foundWithPhotos}`);
  
  await client.close();
}

check().catch(console.error);
