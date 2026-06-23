const pool = require('../db/client.cjs');
const logger = require('../utils/logger.cjs');

async function saveNiche(req, res) {
  try {
    const tenantId = req.user.tenant_id;
    const { niche, business_name } = req.body;
    const allowed = ['dental', 'real_estate', 'agency', 'general'];
    if (!allowed.includes(niche)) {
      return res.status(400).json({ success: false, error: 'Invalid niche' });
    }
    if (!business_name || business_name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Business name required' });
    }
    await pool.query(
      'UPDATE tenants SET niche = $1, business_name = $2, updated_at = NOW() WHERE id = $3',
      [niche, business_name.trim(), tenantId]
    );
    return res.json({ success: true, data: { niche, business_name } });
  } catch (err) {
    logger.error(`[Onboarding] saveNiche: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to save niche' });
  }
}

async function saveConnections(req, res) {
  try {
    const tenantId = req.user.tenant_id;
    const { whatsapp_number, cal_link } = req.body;
    await pool.query(
      'UPDATE tenants SET whatsapp_number = $1, cal_link = $2, updated_at = NOW() WHERE id = $3',
      [whatsapp_number || null, cal_link || null, tenantId]
    );
    return res.json({ success: true, data: { whatsapp_number, cal_link } });
  } catch (err) {
    logger.error(`[Onboarding] saveConnections: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to save connections' });
  }
}

async function completeOnboarding(req, res) {
  try {
    const tenantId = req.user.tenant_id;
    await pool.query(
      'UPDATE tenants SET onboarding_complete = TRUE, updated_at = NOW() WHERE id = $1',
      [tenantId]
    );
    return res.json({ success: true, message: 'Onboarding complete' });
  } catch (err) {
    logger.error(`[Onboarding] completeOnboarding: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to complete onboarding' });
  }
}

async function getOnboardingStatus(req, res) {
  try {
    const tenantId = req.user.tenant_id;
    const result = await pool.query(
      `SELECT niche, business_name, whatsapp_number, cal_link,
              onboarding_complete, subscription_status, plan_id, trial_ends_at
       FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error(`[Onboarding] getOnboardingStatus: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to get status' });
  }
}

module.exports = { saveNiche, saveConnections, completeOnboarding, getOnboardingStatus };
