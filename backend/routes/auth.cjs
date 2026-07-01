const express = require('express');
const router = express.Router();
const { register, login, changePassword } = require('../controllers/auth.cjs');
const { verifyToken } = require('../middleware/auth.cjs');

// POST /auth/register
router.post('/register', async (req, res) => {
  await register(req, res);
});

// POST /auth/login
router.post('/login', async (req, res) => {
  await login(req, res);
});

// POST /auth/change-password (requires auth)
router.post('/change-password', verifyToken, async (req, res) => {
  await changePassword(req, res);
});

module.exports = router;
