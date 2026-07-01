const { v4: uuidv4 } = require('uuid');
const pool = require('../db/client.cjs');
const logger = require('../utils/logger.cjs');

async function saveDraft(req, res) {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'] || 'default';
  const userId = req.user?.id || req.headers['x-user-id'] || null;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  const { draft } = req.body;
  
  if (!draft) {
    return res.status(400).json({
      success: false,
      error: 'Draft data required',
    });
  }

  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  try {
    // Check if draft already exists
    const checkResult = await pool.query(
      `SELECT id FROM content_drafts WHERE id = $1 AND tenant_id = $2`,
      [draft.id, tenantId]
    );
    
    if (checkResult.rows.length > 0) {
      // Update existing draft
      const result = await pool.query(
        `UPDATE content_drafts 
         SET platform = $1, caption = $2, hook = $3, body = $4, cta = $5, 
             hashtags = $6, script = $7, hook_variations = $8, clinic_name = $9, 
             location = $10, audience = $11, goal = $12, tone = $13, 
             avatar_image = $14, status = $15, metadata = $16, updated_at = NOW()
         WHERE id = $17 AND tenant_id = $18
         RETURNING id`,
        [draft.platform, draft.caption, draft.hook, draft.body, draft.cta, 
         draft.hashtags, draft.script, JSON.stringify(draft.hook_variations || []), 
         draft.clinic_name, draft.location, draft.audience, draft.goal, 
         draft.tone, draft.avatar_image, draft.status || 'draft', 
         JSON.stringify(draft.metadata || {}), draft.id, tenantId]
      );
      
      if (result.rows.length > 0) {
        return res.status(200).json({
          success: true,
          message: 'Draft updated successfully',
          id: result.rows[0].id
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'Draft not found for update'
        });
      }
    } else {
      // Create new draft
      const newId = draft.id || uuidv4();
      await pool.query(
        `INSERT INTO content_drafts 
         (id, user_id, tenant_id, platform, caption, hook, body, cta, hashtags, 
          script, hook_variations, clinic_name, location, audience, goal, tone, 
          avatar_image, status, metadata)
         VALUES 
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [newId, userId, tenantId, draft.platform, draft.caption, draft.hook, draft.body, 
         draft.cta, draft.hashtags, draft.script, JSON.stringify(draft.hook_variations || []), 
         draft.clinic_name, draft.location, draft.audience, draft.goal, 
         draft.tone, draft.avatar_image, draft.status || 'draft', 
         JSON.stringify(draft.metadata || {})]
      );
      
      return res.status(201).json({
        success: true,
        message: 'Draft saved successfully',
        id: newId
      });
    }
  } catch (error) {
    logger.error(`Error saving draft: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to save draft',
      details: error.message
    });
  }
}

  

async function getDrafts(req, res) {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'] || 'default';
  const userId = req.user?.id || req.headers['x-user-id'] || null;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM content_drafts
       WHERE tenant_id = $1 AND user_id = $2 AND status = 'draft'
       ORDER BY created_at DESC`,
      [tenantId, userId]
    );
    
    return res.status(200).json({
      success: true,
      drafts: result.rows
    });
  } catch (error) {
    logger.error(`Error fetching drafts: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch drafts',
      details: error.message
    });
  }
}

async function saveScheduledPost(req, res) {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'] || 'default';
  const userId = req.user?.id || req.headers['x-user-id'] || null;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  const { scheduledPost } = req.body;
  
  if (!scheduledPost) {
    return res.status(400).json({
      success: false,
      error: 'Scheduled post data required',
    });
  }

  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  try {
    const newId = scheduledPost.id || uuidv4();
    await pool.query(
      `INSERT INTO scheduled_posts 
       (id, user_id, tenant_id, platform, caption, scheduled_date, scheduled_time, status, metadata)
       VALUES 
       ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [newId, userId, tenantId, scheduledPost.platform, scheduledPost.caption, 
       scheduledPost.scheduled_date, scheduledPost.scheduled_time, scheduledPost.status || 'scheduled', 
       JSON.stringify(scheduledPost.metadata || {})]
    );
    
    return res.status(201).json({
      success: true,
      message: 'Scheduled post saved successfully',
      id: newId
    });
  } catch (error) {
    logger.error(`Error saving scheduled post: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to save scheduled post',
      details: error.message
    });
  }
}

async function getScheduledPosts(req, res) {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'] || 'default';
  const userId = req.user?.id || req.headers['x-user-id'] || null;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM scheduled_posts
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY scheduled_date, scheduled_time`,
      [tenantId, userId]
    );
    
    return res.status(200).json({
      success: true,
      scheduledPosts: result.rows
    });
  } catch (error) {
    logger.error(`Error fetching scheduled posts: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled posts',
      details: error.message
    });
  }
}

async function deleteScheduledPost(req, res) {
  const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'] || 'default';
  const userId = req.user?.id || req.headers['x-user-id'] || null;
  const { id } = req.params;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Post ID required',
    });
  }

  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM scheduled_posts
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [id, tenantId, userId]
    );
    
    if (result.rowCount > 0) {
      return res.status(200).json({
        success: true,
        message: 'Scheduled post deleted successfully'
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Scheduled post not found or not authorized'
      });
    }
  } catch (error) {
    logger.error(`Error deleting scheduled post: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to delete scheduled post',
      details: error.message
    });
  }
}

module.exports = {
  saveDraft,
  getDrafts,
  saveScheduledPost,
  getScheduledPosts,
  deleteScheduledPost
};