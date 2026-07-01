const express = require("express");
const router = express.Router();

const { runOrchestrator, getJobResult } = require("../controllers/orchestrator.cjs");
const { verifyToken, checkUserPlan, limitUsage } = require("../middleware/auth.cjs");
const { orchestratorValidationRules, validateOrchestratorRequest } = require("../middleware/validation.cjs");
const { saveDraft, getDrafts, saveScheduledPost, getScheduledPosts, deleteScheduledPost } = require("../controllers/drafts.cjs");
const { saveCampaign, getCampaigns, updateCampaignStatus } = require("../controllers/campaigns.cjs");

router.post("/orchestrator", verifyToken, checkUserPlan, limitUsage, orchestratorValidationRules, validateOrchestratorRequest, runOrchestrator);
router.get("/jobs/:jobId", verifyToken, checkUserPlan, limitUsage, getJobResult);
router.post("/drafts", verifyToken, saveDraft);
router.get("/drafts", verifyToken, getDrafts);
router.post("/scheduled-posts", verifyToken, saveScheduledPost);
router.get("/scheduled-posts", verifyToken, getScheduledPosts);
router.delete("/scheduled-posts/:id", verifyToken, deleteScheduledPost);

// Campaigns API routes
router.post("/campaigns", verifyToken, saveCampaign);
router.get("/campaigns", verifyToken, getCampaigns);
router.put("/campaigns/:id/status", verifyToken, updateCampaignStatus);

module.exports = router;