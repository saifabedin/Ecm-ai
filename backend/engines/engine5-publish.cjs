const dotenv = require("dotenv");
const { join } = require("path");
// Load ecm-ai-os .env first, then fallback to ai-team .env for shared keys
dotenv.config({ path: join(__dirname, "../.env") });
dotenv.config({ path: "/home/ubuntu/ai-team/.env" });

const axios = require("axios");
const { uuidv4 } = require("../utils/uuid.cjs");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger.cjs");

const GRAPH = "https://graph.facebook.com/v25.0";

// Cache the derived Page token with a TTL so we don't hit /me/accounts on every job.
const _pageTokenCache = {};
const PAGE_TOKEN_TTL_MS = 3600000;

// Local savePostsToFile (the original module never existed).
const savePostsToFile = async (jobId, data) => {
  try {
    const postsDir = path.join(__dirname, "../../published_posts");
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, { recursive: true });
    }
    const filePath = path.join(postsDir, `post-${jobId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    logger.info(`[Engine5] Posts saved to file: ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error(`[Engine5] Error saving posts to file: ${error.message}`);
    return null;
  }
};

/**
 * P1 FIX: The configured FB_PAGE_ACCESS_TOKEN is a USER token. Posting to a
 * Page feed requires a PAGE token (pages_manage_posts + pages_read_engagement).
 * Exchange the user token for the page's own access token via /me/accounts.
 */
async function getPageAccessToken(userToken, pageId) {
  const cached = _pageTokenCache[pageId];
  if (cached && (Date.now() - cached.cachedAt) < PAGE_TOKEN_TTL_MS) {
    return cached.token;
  }
  // If the configured token is ALREADY a Page token, /me resolves to the Page
  // itself (and /me/accounts doesn't exist on it). Detect that and use it as-is.
  try {
    const meResp = await axios.get(`${GRAPH}/me`, {
      params: { access_token: userToken, fields: "id" },
    });
    if (meResp.data?.id === pageId) {
      _pageTokenCache[pageId] = { token: userToken, cachedAt: Date.now() };
      return userToken;
    }
  } catch (_) {
    // fall through to user-token derivation below
  }
  const resp = await axios.get(`${GRAPH}/me/accounts`, {
    params: { access_token: userToken, fields: "id,access_token", limit: 100 },
  });
  const page = (resp.data?.data || []).find((p) => p.id === pageId);
  if (!page || !page.access_token) {
    throw new Error(
      `Could not derive a Page token for FB_PAGE_ID=${pageId}. ` +
        `The user token either does not manage this page or lacks ` +
        `pages_show_list / pages_manage_posts permission.`
    );
  }
  _pageTokenCache[pageId] = { token: page.access_token, cachedAt: Date.now() };
  return page.access_token;
}

async function publishContent(input) {
  const jobId = uuidv4();
  const engine = "engine5-publish";

  logger.info("[Engine5] Starting content publishing...");

  // Extract content (unchanged logic)
  let content = "";
  if (input.content && Array.isArray(input.content.captions)) {
    content = input.content.captions[0];
  } else if (input.script) {
    content = input.script;
  } else if (input.content && Array.isArray(input.content.reelsScripts)) {
    content = input.content.reelsScripts.join(" ");
  } else {
    content =
      "Welcome to our amazing place! Try our special dishes today! Visit us now!";
  }
  logger.info(`[Engine5] Content to publish: ${content.substring(0, 100)}...`);

  // Try to get token from database first (per-brand OAuth tokens)
  let userToken = null;
  let fbPageId = input.pageId || process.env.FB_PAGE_ID;

  if (input.brandId) {
    try {
      const db = require("../db/client.cjs");
      const result = await db.query(
        `SELECT access_token, meta FROM ait_social_accounts
         WHERE brand_id=$1 AND platform='facebook' AND status='active'
         ORDER BY created_at DESC LIMIT 1`,
        [input.brandId]
      );
      if (result.rows.length > 0) {
        userToken = result.rows[0].access_token;
        fbPageId = fbPageId || result.rows[0].account_id;
        logger.info(`[Engine5] Using stored token for brand ${input.brandId}`);
      }
    } catch (e) {
      logger.warn(`[Engine5] Could not load stored token: ${e.message}`);
    }
  }

  // Fallback to env vars
  if (!userToken) userToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!fbPageId) fbPageId = process.env.FB_PAGE_ID;

  // P2 FIX: missing credentials is a REAL failure, not a silent mock success.
  if (!userToken || !fbPageId) {
    const error =
      "Facebook publish aborted: No token found. Connect Facebook via /auth/facebook/connect or set FB_PAGE_ACCESS_TOKEN in .env";
    logger.error(`[Engine5] ${error}`);
    return { success: false, engine, jobId, data: null, error };
  }

  try {
    // P1 FIX: use a real Page token, not the user token.
    const pageToken = await getPageAccessToken(userToken, fbPageId);

    logger.info("[Engine5] Publishing to Facebook Page via Graph API...");
    const fbResponse = await axios.post(`${GRAPH}/${fbPageId}/feed`, {
      message: content,
      access_token: pageToken,
    });

    const facebookPostId = fbResponse.data && fbResponse.data.id;
    if (!facebookPostId) {
      throw new Error(
        "Graph API returned no post id: " + JSON.stringify(fbResponse.data)
      );
    }
    const facebookPostUrl = `https://www.facebook.com/${facebookPostId}`;
    logger.info(`[Engine5] Facebook post published: ${facebookPostUrl}`);

    const data = {
      facebook_post: { id: facebookPostId, url: facebookPostUrl },
      // Instagram publishing is not implemented yet (P4, out of scope).
      // Return null instead of a fake URL so nothing downstream is misled.
      instagram_post: null,
      savedToFile: `published_posts/post-${jobId}.json`,
      platforms: ["facebook"],
    };

    await savePostsToFile(jobId, data);

    logger.info("[Engine5] Execution completed successfully");
    return { success: true, engine, jobId, data, error: null };
  } catch (err) {
    // P2 FIX: surface the REAL error. No fake success, no mock URLs.
    const fbError = err.response && err.response.data && err.response.data.error;
    const msg = fbError ? `(#${fbError.code}) ${fbError.message}` : err.message;
    logger.error(`[Engine5] Publish failed: ${msg}`);
    return { success: false, engine, jobId, data: null, error: msg };
  }
}

module.exports = publishContent;
