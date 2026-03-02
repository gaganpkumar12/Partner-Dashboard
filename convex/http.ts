import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const ZOHO_CONFIG = {
  clientId: "1000.1EMRVBV2557BITZMM9W7QK107JU7DO",
  clientSecret: "7667eb1044cd7ce460785a91bdc80eedcca825630d",
  refreshToken:
    "1000.3a686cf0bd0e512501f3710b0bf3f8b9.5dd6b70e5d8423aa387a41514f1fb89c",
  region: ".in",
};

async function getAccessTokenCached(ctx: any): Promise<string> {
  // Try cached token first
  const cached = await ctx.runMutation(internal.mutations.getCachedToken, {});
  if (cached) return cached;

  // Refresh token from Zoho
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
    throw new Error("Failed to get Zoho access token: " + JSON.stringify(data));
  }

  // Cache it (Zoho tokens expire in ~3600s, cache for 50 min)
  const expiresAt = Date.now() + 50 * 60 * 1000;
  await ctx.runMutation(internal.mutations.setCachedToken, {
    accessToken: data.access_token,
    expiresAt,
  });

  return data.access_token;
}

const http = httpRouter();

// Image/media proxy endpoint: /image-proxy?url=<zoho-url>
// Fetches images/videos from Zoho Creator API with cached OAuth token
http.route({
  path: "/image-proxy",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
      return new Response("Missing 'url' parameter", { status: 400 });
    }

    try {
      const accessToken = await getAccessTokenCached(ctx);

      const response = await fetch(imageUrl, {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error(`Image proxy failed: ${response.status} for ${imageUrl}`);
        return new Response("Failed to fetch image", { status: 502 });
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const data = await response.arrayBuffer();

      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error: any) {
      console.error("Image proxy error:", error.message);
      return new Response("Image proxy error: " + error.message, { status: 500 });
    }
  }),
});

// CORS preflight for image proxy
http.route({
  path: "/image-proxy",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
