// backend/routes/admin.cjs
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.cjs');
const requireSuperAdmin = require('../middleware/requireSuperAdmin.cjs');
const { getAllUsers, getUserUsage, updateUserStatus, getPlatformStats } = require('../controllers/admin.cjs');

// All admin routes require auth + super admin
router.use(verifyToken, requireSuperAdmin);

router.get('/users',                  getAllUsers);
router.get('/users/:id/usage',        getUserUsage);
router.patch('/tenants/:id/status',   updateUserStatus);
router.get('/stats',                  getPlatformStats);

module.exports = router;
