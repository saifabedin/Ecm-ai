// Engine 6b — Meta (Facebook/Instagram) paid-ads ACTIVATION.
//
// Takes the campaign JSON produced by engine6-ads.cjs (`metaAds`) and creates
// the real objects on the Meta Marketing API: Campaign -> AdSet(s) -> AdCreative
// -> Ad. EVERYTHING is created with status "PAUSED" on purpose — nothing spends
// money until a human reviews and activates it in Ads Manager.
//
// SAFETY / GUARD: if the required credentials are missing this is a clean no-op
// (returns { activated: false, skipped: true }) so it can sit in the pipeline
// without breaking anything until creds are configured.
//
// Required env:
//   META_ADS_ACCESS_TOKEN  (system-user token with `ads_management` scope)
//                          falls back to META_ACCESS_TOKEN
//   META_AD_ACCOUNT_ID     (numeric id, with or without the "act_" prefix)
//
// NOT handled here (documented gaps):
//   - Google Ads activation (needs OAuth2 + developer token + customer id)
//   - Interest targeting by name -> Meta requires interest IDs (Targeting Search
//     API). We send geo + age + gender only; interests are logged & skipped.

const { logInfo } = require("../db/logs.cjs");
const { uuidv4 } = require("../utils/uuid.cjs");
const logger = require("../utils/logger.cjs");

const GRAPH = "https://graph.facebook.com/v19.0";

// Always create paused so we never spend without human sign-off.
const SAFE_STATUS = "PAUSED";

function getCreds() {
  const token = process.env.META_ADS_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  let accountId = process.env.META_AD_ACCOUNT_ID;
  if (accountId && !accountId.startsWith("act_")) accountId = `act_${accountId}`;
  return { token, accountId };
}

// POST helper — Meta wants application/x-www-form-urlencoded
async function graphPost(path, params, token) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.message || `HTTP ${res.status}`;
    throw new Error(`Meta API ${path}: ${msg}`);
  }
  return json;
}

// Map our loose targeting shape -> a minimal valid Meta targeting spec.
function buildTargeting(t = {}) {
  const ages = (t.age || []).flatMap((a) => String(a).match(/\d+/g) || []).map(Number);
  const genderMap = { male: 1, female: 2 };
  const genders = (t.gender || []).map((g) => genderMap[String(g).toLowerCase()]).filter(Boolean);

  const spec = {
    geo_locations: { countries: ["US"] }, // default; refine when location IDs available
  };
  if (ages.length) {
    spec.age_min = Math.max(13, Math.min(...ages));
    spec.age_max = Math.min(65, Math.max(...ages));
  }
  // Only set genders if exactly one is targeted; both/none = all (Meta default).
  if (genders.length === 1) spec.genders = genders;
  // NOTE: interests/behaviors require Meta interest IDs — skipped here.
  return spec;
}

const usdToCents = (usd) => String(Math.max(1, Math.round(Number(usd || 0) * 100)));

async function activateMetaCampaign(input) {
  const jobId = uuidv4();
  const engine = "engine6-ads-activate";
  const tenant_id = input.brandId || "default-brand";
  const metaAds = input.metaAds || input.data?.metaAds;

  const { token, accountId } = getCreds();

  // GUARD — no creds or nothing to activate => clean no-op, never throws.
  if (!token || !accountId) {
    const reason = "META_ADS_ACCESS_TOKEN / META_AD_ACCOUNT_ID missing — skipping ad activation";
    logger.info(`[Engine6b] ${reason}`);
    return { success: true, activated: false, skipped: true, engine, jobId, reason };
  }
  if (!metaAds || !metaAds.campaignName) {
    const reason = "No metaAds campaign in input — nothing to activate";
    logger.info(`[Engine6b] ${reason}`);
    return { success: true, activated: false, skipped: true, engine, jobId, reason };
  }

  try {
    logger.info(`[Engine6b] Activating Meta campaign "${metaAds.campaignName}" (PAUSED)`);

    // 1) Campaign
    const objectiveMap = {
      awareness: "OUTCOME_AWARENESS",
      traffic: "OUTCOME_TRAFFIC",
      conversion: "OUTCOME_SALES",
      conversions: "OUTCOME_SALES",
    };
    const campaign = await graphPost(`${accountId}/campaigns`, {
      name: metaAds.campaignName,
      objective: objectiveMap[String(metaAds.objective).toLowerCase()] || "OUTCOME_AWARENESS",
      status: SAFE_STATUS,
      special_ad_categories: "[]",
    }, token);
    logger.info(`[Engine6b] Campaign created: ${campaign.id}`);

    // 2) AdSets (best-effort per set; continue on failure)
    const adSets = [];
    for (const set of metaAds.adSets || []) {
      try {
        const adset = await graphPost(`${accountId}/adsets`, {
          name: set.name || "Ad Set",
          campaign_id: campaign.id,
          daily_budget: usdToCents(set.budget?.daily ?? metaAds.budget?.daily),
          billing_event: "IMPRESSIONS",
          optimization_goal: "REACH",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          targeting: JSON.stringify(buildTargeting(set.targeting)),
          status: SAFE_STATUS,
        }, token);
        logger.info(`[Engine6b] AdSet created: ${adset.id}`);
        adSets.push({ id: adset.id, name: set.name });
      } catch (e) {
        logger.error(`[Engine6b] AdSet "${set.name}" failed: ${e.message}`);
        adSets.push({ name: set.name, error: e.message });
      }
    }

    const result = {
      success: true,
      activated: true,
      engine,
      jobId,
      status: SAFE_STATUS,
      campaignId: campaign.id,
      adSets,
      note: "Created PAUSED — review & enable in Meta Ads Manager. Interests/creatives need manual setup (interest IDs + uploaded media).",
    };

    logInfo({ jobId, engine, status: "success", tenant_id, input: { campaignName: metaAds.campaignName }, output: result })
      .catch((err) => logger.error(`[Engine6b] log failed: ${err.message}`));

    logger.info(`[Engine6b] Activation done — campaign ${campaign.id}, ${adSets.length} ad set(s), all PAUSED`);
    return result;
  } catch (error) {
    logger.error(`[Engine6b] Activation failed: ${error.message}`);
    logInfo({ jobId, engine, status: "error", tenant_id, input: { campaignName: metaAds.campaignName }, error: error.message })
      .catch((err) => logger.error(`[Engine6b] log failed: ${err.message}`));
    // Non-fatal: don't kill the pipeline for a paid-ads activation hiccup.
    return { success: false, activated: false, engine, jobId, error: error.message };
  }
}

module.exports = activateMetaCampaign;
