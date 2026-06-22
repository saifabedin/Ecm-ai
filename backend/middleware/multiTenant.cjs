const pool = require("../db/client.cjs");

async function getUserPlan(userId) {
  try {
    if (!pool) {
      throw new Error('Database unavailable');
    }
    console.log("[getUserPlan] Looking for user:", userId);
    const result = await pool.query(
      `SELECT u.*
       FROM users u
       WHERE u.id = $1`,
      [userId]
    );
    console.log("[getUserPlan] Query result:", result.rows.length, "rows");

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error("[Auth] Error getting user plan:", error);
    throw error; // fail closed — don't silently bypass plan checks
  }
}

async function getUserUsage(userId, month = new Date().getMonth(), year = new Date().getFullYear()) {
  try {
    if (!pool) {
      throw new Error('Database unavailable');
    }
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1); // first of next month, exclusive

    const result = await pool.query(
      `SELECT COUNT(*) as request_count, SUM(tokens_used) as total_tokens, SUM(cost) as total_cost
       FROM usage_logs
       WHERE user_id = $1
       AND created_at >= $2
       AND created_at < $3
       AND status = 'completed'`,
      [userId, startDate, endDate]
    );

    return result.rows[0] || { request_count: 0, total_tokens: 0, total_cost: 0 };
  } catch (error) {
    console.error("[Auth] Error getting user usage:", error);
    throw error;
  }
}

async function checkUserPlan(req, res, next) {
  try {
    const userId = req.user?.id || req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: User ID required",
      });
    }

    let userPlan;
    try {
      userPlan = await getUserPlan(userId);
      if (!userPlan) {
        console.log("[checkUserPlan] User not found or inactive");
        return res.status(403).json({
          success: false,
          error: "User not found or inactive",
        });
      }
    } catch (error) {
      console.error("[Auth] Error in checkUserPlan:", error);
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }

    req.userPlan = userPlan;
    req.userId = userId;

    next();
  } catch (error) {
    console.error("[Auth] Error in checkUserPlan:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

async function limitUsage(req, res, next) {
  try {
    if (!req.userId || !req.userPlan) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: User context required",
      });
    }

    const usage = await getUserUsage(req.userId);

    const requestCount = parseInt(usage.request_count) || 0;
    const monthlyLimit = parseInt(req.userPlan.monthly_requests) || 100;

    if (requestCount >= monthlyLimit) {
      return res.status(429).json({
        success: false,
        error: "Monthly request limit exceeded",
        current: requestCount,
        limit: monthlyLimit,
        plan: req.userPlan.plan_id,
      });
    }

    req.usage = {
      current: requestCount,
      limit: monthlyLimit,
      remaining: monthlyLimit - requestCount,
    };

    next();
  } catch (error) {
    console.error("[Auth] Error in limitUsage:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

async function logUsage(userId, jobId, jobType, status, tokensUsed = 0, cost = 0, metadata = {}) {
  try {
    if (!pool) {
      throw new Error('Database unavailable');
    }
    await pool.query(
      `INSERT INTO usage_logs (user_id, job_id, job_type, status, tokens_used, cost, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, jobId, jobType, status, tokensUsed, cost, JSON.stringify(metadata)]
    );

    return { success: true };
  } catch (error) {
    console.error("[Auth] Error logging usage:", error);
    return { success: false, error: error.message };
  }
}

async function getUserStats(userId) {
  try {
    const plan = await getUserPlan(userId);
    const usage = await getUserUsage(userId);

    return {
      success: true,
      user: {
        id: userId,
        plan: plan?.plan_id || "free",
        planName: plan?.name || "Free Plan",
      },
      usage: {
        current: usage.request_count,
        limit: plan?.monthly_requests || 100,
        remaining: (plan?.monthly_requests || 100) - usage.request_count,
        tokensUsed: usage.total_tokens || 0,
        totalCost: usage.total_cost || 0,
      },
    };
  } catch (error) {
    console.error("[Auth] Error getting user stats:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getUserPlan,
  getUserUsage,
  checkUserPlan,
  limitUsage,
  logUsage,
  getUserStats,
};
