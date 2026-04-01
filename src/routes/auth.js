const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { success, createError } = require('../utils/response');

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(createError('VALIDATION_ERROR', 'email and password are required', 400));
    }

    // TODO: Replace with real password hashing (bcrypt) and DB lookup
    const result = await query(
      'SELECT id, email, brand_id, role, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (!result.rows.length) {
      return next(createError('INVALID_CREDENTIALS', 'Invalid email or password', 401));
    }

    const user = result.rows[0];
    // TODO: bcrypt.compare(password, user.password_hash)

    const token = jwt.sign(
      { user_id: user.id, brand_id: user.brand_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    return success(res, {
      brand_id: user.brand_id,
      engine_id: null,
      token,
      user: { id: user.id, email: user.email, role: user.role, brand_id: user.brand_id }
    });
  } catch (err) {
    next(createError('AUTH_FAILED', err.message, 500));
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, brand_name } = req.body;
    if (!email || !password || !brand_name) {
      return next(createError('VALIDATION_ERROR', 'email, password, and brand_name are required', 400));
    }

    // TODO: implement full registration with bcrypt + brand creation
    return next(createError('NOT_IMPLEMENTED', 'Registration not yet implemented', 501));
  } catch (err) {
    next(createError('REGISTER_FAILED', err.message, 500));
  }
});

module.exports = router;
