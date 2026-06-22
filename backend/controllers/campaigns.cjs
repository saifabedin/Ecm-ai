const { v4: uuidv4 } = require('uuid');
const pool = require('../db/client.cjs');

async function saveCampaign(req, res) {
  const tenantId = req.user?.tenant_id || null;
  const userId = req.user?.id || null;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  if (!tenantId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const { campaign } = req.body;

  if (!campaign) {
    return res.status(400).json({
      success: false,
      error: 'Campaign data required',
    });
  }

  try {
    const newId = uuidv4();
    await pool.query(
      `INSERT INTO campaigns
       (id, user_id, tenant_id, name, platform, budget, status, start_date, end_date, metadata, created_at, updated_at)
       VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [newId, userId, tenantId, campaign.name, campaign.platform, campaign.budget,
       campaign.status || 'active', campaign.start_date, campaign.end_date,
       JSON.stringify(campaign.metadata || {})]
    );

    return res.status(201).json({
      success: true,
      message: 'Campaign saved successfully',
      id: newId
    });
  } catch (error) {
    console.error('Error saving campaign:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save campaign',
    });
  }
}

async function getCampaigns(req, res) {
  const tenantId = req.user?.tenant_id || null;
  const userId = req.user?.id || null;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  if (!tenantId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM campaigns
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [tenantId, userId]
    );

    return res.status(200).json({
      success: true,
      campaigns: result.rows
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns',
    });
  }
}

async function updateCampaignStatus(req, res) {
  const tenantId = req.user?.tenant_id || null;
  const userId = req.user?.id || null;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  if (!tenantId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const { status } = req.body;

  const VALID_STATUSES = ['active', 'paused', 'completed', 'draft'];
  if (!status) {
    return res.status(400).json({ success: false, error: 'Status is required' });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE campaigns
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND user_id = $4
       RETURNING id`,
      [status, id, tenantId, userId]
    );

    if (result.rows.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Campaign status updated successfully'
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
  } catch (error) {
    console.error('Error updating campaign status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update campaign status',
    });
  }
}

module.exports = {
  saveCampaign,
  getCampaigns,
  updateCampaignStatus
};
