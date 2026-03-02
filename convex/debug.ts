import { action } from "./_generated/server";

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
  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Token error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Debug action to inspect raw Zoho fields, especially image fields
export const inspectImageFields = action({
  args: {},
  handler: async () => {
    const accessToken = await getAccessToken();
    const baseUrl = `https://creator.zoho${ZOHO_CONFIG.region}/api/v2/${ZOHO_CONFIG.ownerName}/${ZOHO_CONFIG.appLinkName}/report/${ZOHO_CONFIG.reportLinkName}`;

    // Fetch a larger batch and look for records with non-empty image fields
    const response = await fetch(`${baseUrl}?from=100&limit=200`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await response.json();
    const records = data?.data || [];

    const withPhotos: any[] = [];
    const allFieldNames = new Set<string>();

    for (const r of records) {
      // Collect all field names
      for (const key of Object.keys(r)) {
        allFieldNames.add(key);
      }

      // Check for non-empty image-like fields
      const bp = r.Before_Photos;
      const rs = r.Reached_Selfie;
      const fi = r.Feedback_Form_1_Image;

      const hasPhotos =
        (Array.isArray(bp) && bp.length > 0) ||
        (Array.isArray(rs) && rs.length > 0) ||
        (Array.isArray(fi) && fi.length > 0);

      if (hasPhotos && withPhotos.length < 5) {
        withPhotos.push({
          ID: r.ID,
          Partner_Name: r.Partner_Name,
          Before_Photos: r.Before_Photos,
          Before_Photos_type: typeof r.Before_Photos,
          Reached_Selfie: r.Reached_Selfie,
          Feedback_Form_1_Image: r.Feedback_Form_1_Image,
          // Check for any other fields that might be images
          all_keys: Object.keys(r),
        });
      }
    }

    // Also get the full list of field names to find any image/file/photo fields
    const imageRelatedFields = [...allFieldNames].filter(
      (f) =>
        f.toLowerCase().includes("image") ||
        f.toLowerCase().includes("photo") ||
        f.toLowerCase().includes("selfie") ||
        f.toLowerCase().includes("picture") ||
        f.toLowerCase().includes("file") ||
        f.toLowerCase().includes("video") ||
        f.toLowerCase().includes("attachment")
    );

    return {
      totalChecked: records.length,
      recordsWithPhotos: withPhotos.length,
      withPhotos,
      allFieldNames: [...allFieldNames],
      imageRelatedFields,
    };
  },
});

// Debug action to inspect Jobs1 report fields
export const inspectJobsFields = action({
  args: {},
  handler: async () => {
    const accessToken = await getAccessToken();
    const baseUrl = `https://creator.zoho${ZOHO_CONFIG.region}/api/v2/${ZOHO_CONFIG.ownerName}/${ZOHO_CONFIG.appLinkName}/report/All_Jobs1`;

    const response = await fetch(`${baseUrl}?from=0&limit=5`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `API error ${response.status}: ${errText}` };
    }

    const data = await response.json();
    const records = data?.data || [];

    return {
      totalRecords: records.length,
      fieldNames: records.length > 0 ? Object.keys(records[0]) : [],
      sampleRecords: records.slice(0, 3),
    };
  },
});
