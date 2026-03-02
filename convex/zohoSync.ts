import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

// Zoho Creator API configuration
const ZOHO_CONFIG = {
  clientId: "1000.1EMRVBV2557BITZMM9W7QK107JU7DO",
  clientSecret: "7667eb1044cd7ce460785a91bdc80eedcca825630d",
  refreshToken:
    "1000.3a686cf0bd0e512501f3710b0bf3f8b9.5dd6b70e5d8423aa387a41514f1fb89c",
  region: ".in",
  ownerName: "cleanfanatics943",
  appLinkName: "partner-application",
  reportLinkName: "All_Bookings",
};

// Get a fresh access token from Zoho (standalone, for use in actions)
async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://accounts.zoho${ZOHO_CONFIG.region}/oauth/v2/token`;

  const params = new URLSearchParams({
    refresh_token: ZOHO_CONFIG.refreshToken,
    client_id: ZOHO_CONFIG.clientId,
    client_secret: ZOHO_CONFIG.clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(`${tokenUrl}?${params.toString()}`, {
    method: "POST",
  });

  if (!response.ok) {
    const errText = await response.text();
    // Provide a short, user-friendly message for rate limits
    if (errText.includes("too many requests") || response.status === 429) {
      throw new Error("Rate limited — please try again later");
    }
    throw new Error(`Failed to get Zoho access token: ${errText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(
      `No access_token in response: ${JSON.stringify(data)}`
    );
  }

  return data.access_token;
}

// Get access token with DB caching (for use inside actions with ctx)
async function getAccessTokenCached(ctx: any): Promise<string> {
  // Try cache first
  const cached = await ctx.runMutation(internal.mutations.getCachedToken, {});
  if (cached) return cached;

  // Refresh
  const token = await getAccessToken();

  // Cache for 50 min (Zoho tokens expire in ~60 min)
  await ctx.runMutation(internal.mutations.setCachedToken, {
    accessToken: token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  });

  return token;
}

const ZOHO_CREATOR_BASE = `https://creator.zoho${ZOHO_CONFIG.region}`;

// Extract string array from Zoho image/file fields
// Zoho returns relative paths like /api/v2/owner/app/report/Report/ID/Field/download?filepath=...
// We need to convert them to full URLs
function extractUrls(field: any): string[] {
  if (!Array.isArray(field)) return [];
  return field
    .map((item: any) => {
      let path = "";
      if (typeof item === "string") path = item;
      else if (item?.url) path = item.url;
      else if (item?.display_value) path = item.display_value;
      else return "";

      // If it's a relative path, prepend the Zoho Creator base URL
      if (path.startsWith("/api/")) {
        return `${ZOHO_CREATOR_BASE}${path}`;
      }
      return path;
    })
    .filter((url: string) => url.length > 0);
}

// Parse a raw Zoho record into our DB shape
function parseRecord(record: any) {
  const stage = record["Blueprint.Current_Stage"];
  const statusDisplay =
    stage?.display_value || record.Status || record.status || "Unknown";

  return {
    zohoId: String(record.ID || ""),
    partnerName: (record.Partner_Name || "").trim(),
    status: statusDisplay,
    statusRaw: typeof stage === "object" ? JSON.stringify(stage) : statusDisplay,
    adminNote: record.Admin_Note || "",
    phoneNumber: record.Phone_Number || "",
    addedTime: record.Added_Time || "",
    rating: record.Rating || "",
    beforePhotos: extractUrls(record.Before_Photos),
    reachedSelfie: extractUrls(record.Reached_Selfie),
    feedbackImages: extractUrls(record.Feedback_Form_1_Image),
    lunchCheckoutVideo: (() => {
      const v = record.Lunch_Time_Check_Out_Video;
      if (!v) return "";
      if (typeof v === "string") return v.startsWith("/api/") ? `${ZOHO_CREATOR_BASE}${v}` : v;
      if (v?.url) return v.url.startsWith("/api/") ? `${ZOHO_CREATOR_BASE}${v.url}` : v.url;
      return "";
    })(),
    rawData: JSON.stringify(record),
  };
}

// Fetch all records from Zoho Creator with pagination
async function fetchAllRecordsFromZoho(accessToken: string): Promise<any[]> {
  const baseUrl = `https://creator.zoho${ZOHO_CONFIG.region}/api/v2/${ZOHO_CONFIG.ownerName}/${ZOHO_CONFIG.appLinkName}/report/${ZOHO_CONFIG.reportLinkName}`;

  const MAX_RECORDS = 1000;
  let allRecords: any[] = [];
  let from = 0;
  const limit = 200;
  let hasMore = true;

  while (hasMore) {
    const url = `${baseUrl}?from=${from}&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Zoho API error (${response.status}): ${errText}`
      );
    }

    const data = await response.json();
    const records = data?.data || [];
    allRecords = allRecords.concat(records);

    console.log(`[Zoho] Fetched ${records.length} records (from ${from})`);

    if (records.length < limit || allRecords.length >= MAX_RECORDS) {
      hasMore = false;
    } else {
      from += limit;
    }
  }

  // Trim to max limit
  if (allRecords.length > MAX_RECORDS) {
    allRecords = allRecords.slice(0, MAX_RECORDS);
  }

  console.log(`[Zoho] Total records fetched: ${allRecords.length}`);
  return allRecords;
}

// ─── Main sync action ───────────────────────────────────────────
// This action fetches all records from Zoho and stores them in Convex DB
export const syncFromZoho = action({
  args: {},
  handler: async (ctx) => {
    console.log("[Sync] Starting Zoho sync...");

    // Mark sync as in progress
    await ctx.runMutation(internal.mutations.updateSyncStatus, {
      totalRecords: 0,
      status: "syncing",
    });

    try {
      // Fetch all records from Zoho Creator
      const accessToken = await getAccessTokenCached(ctx);
      const rawRecords = await fetchAllRecordsFromZoho(accessToken);

      // Parse and batch upsert into Convex DB
      const parsed = rawRecords.map(parseRecord);

      // Process in batches of 50 to avoid mutation size limits
      const BATCH_SIZE = 50;
      let totalUpserted = 0;

      for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
        const batch = parsed.slice(i, i + BATCH_SIZE);
        const count = await ctx.runMutation(
          internal.mutations.upsertBookingBatch,
          { records: batch }
        );
        totalUpserted += count;
        console.log(
          `[Sync] Upserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${totalUpserted}/${parsed.length})`
        );
      }

      // Mark sync as complete
      await ctx.runMutation(internal.mutations.updateSyncStatus, {
        totalRecords: totalUpserted,
        status: "success",
      });

      console.log(`[Sync] Complete! ${totalUpserted} records synced.`);
      return { success: true, total: totalUpserted };
    } catch (error: any) {
      console.error("[Sync] Error:", error.message);

      await ctx.runMutation(internal.mutations.updateSyncStatus, {
        totalRecords: 0,
        status: "error",
        errorMessage: error.message,
      });

      return { success: false, error: error.message };
    }
  },
});

// Full re-sync: clear all records and fetch again
export const fullResync = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; total?: number; error?: string }> => {
    console.log("[Sync] Full resync - clearing all records...");

    await ctx.runMutation(internal.mutations.clearAllBookings, {});

    // Now run normal sync
    return await ctx.runAction(api.zohoSync.syncFromZoho, {});
  },
});

// ─── Jobs Sync ──────────────────────────────────────────────────

const JOBS_REPORT = "All_Jobs1";

function parseJobRecord(record: any) {
  return {
    zohoId: String(record.ID || ""),
    bookingId: String(record.Booking_ID || ""),
    portalUsers: (record.Portal_Users || "").trim(),
    adminNote: record.Admin_Note || "",
    paymentMode: record.Payment_Mode || "",
    amount: record.Amount || "",
    addedTime: record.Added_Time || "",
    addedUser: record.Added_User || "",
    afterPhotos: extractUrls(record.After_Photos),
    feedbackImages: extractUrls(record.Feedback_Form_2_Image),
    paymentProofPhotos: extractUrls(record.Payment_Proof_Photo),
    eveningCheckoutVideo: (() => {
      const v = record.Evening_Check_out_Video;
      if (!v) return "";
      if (typeof v === "string") return v.startsWith("/api/") ? `${ZOHO_CREATOR_BASE}${v}` : v;
      if (v?.url) return v.url.startsWith("/api/") ? `${ZOHO_CREATOR_BASE}${v.url}` : v.url;
      return "";
    })(),
    addOns: (() => {
      if (!Array.isArray(record.Add_ons)) return "";
      return record.Add_ons.map((a: any) => a.display_value || "").filter(Boolean).join("; ");
    })(),
    rawData: JSON.stringify(record),
  };
}

async function fetchAllJobsFromZoho(accessToken: string): Promise<any[]> {
  const baseUrl = `${ZOHO_CREATOR_BASE}/api/v2/${ZOHO_CONFIG.ownerName}/${ZOHO_CONFIG.appLinkName}/report/${JOBS_REPORT}`;

  const MAX_RECORDS = 1000;
  let allRecords: any[] = [];
  let from = 0;
  const limit = 200;
  let hasMore = true;

  while (hasMore) {
    const url = `${baseUrl}?from=${from}&limit=${limit}`;
    const response = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Zoho Jobs API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const records = data?.data || [];
    allRecords = allRecords.concat(records);

    console.log(`[Jobs] Fetched ${records.length} records (from ${from})`);

    if (records.length < limit || allRecords.length >= MAX_RECORDS) {
      hasMore = false;
    } else {
      from += limit;
    }
  }

  // Trim to max limit
  if (allRecords.length > MAX_RECORDS) {
    allRecords = allRecords.slice(0, MAX_RECORDS);
  }

  console.log(`[Jobs] Total records fetched: ${allRecords.length}`);
  return allRecords;
}

// Sync jobs from Zoho
export const syncJobsFromZoho = action({
  args: {},
  handler: async (ctx) => {
    console.log("[Jobs Sync] Starting...");

    try {
      const accessToken = await getAccessTokenCached(ctx);
      const rawRecords = await fetchAllJobsFromZoho(accessToken);
      const parsed = rawRecords.map(parseJobRecord);

      const BATCH_SIZE = 50;
      let totalUpserted = 0;

      for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
        const batch = parsed.slice(i, i + BATCH_SIZE);
        const count = await ctx.runMutation(internal.mutations.upsertJobBatch, {
          records: batch,
        });
        totalUpserted += count;
        console.log(
          `[Jobs Sync] Upserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${totalUpserted}/${parsed.length})`
        );
      }

      console.log(`[Jobs Sync] Complete! ${totalUpserted} records synced.`);
      return { success: true, total: totalUpserted };
    } catch (error: any) {
      console.error("[Jobs Sync] Error:", error.message);
      return { success: false, error: error.message };
    }
  },
});

// Full re-sync jobs
export const fullJobsResync = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; total?: number; error?: string }> => {
    console.log("[Jobs Sync] Full resync - clearing all jobs...");
    await ctx.runMutation(internal.mutations.clearAllJobs, {});
    return await ctx.runAction(api.zohoSync.syncJobsFromZoho, {});
  },
});
