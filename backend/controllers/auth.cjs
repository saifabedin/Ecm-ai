const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/client.cjs');
const logger = require('../utils/logger.cjs');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('[auth] JWT_SECRET environment variable is not set');

async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tenantResult = await client.query(
        'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
        [name]
      );
      const tenantId = tenantResult.rows[0].id;
      const userResult = await client.query(
        'INSERT INTO users (name, email, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, tenant_id',
        [name, email.toLowerCase(), passwordHash, 'user', tenantId]
      );
      await client.query('COMMIT');
      const user = userResult.rows[0];

      const token = jwt.sign(
        {
          user_id: user.id,
          tenant_id: user.tenant_id,
          role: 'user',
          is_super_admin: false
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            tenant_id: user.tenant_id,
            name,
            email: email.toLowerCase(),
            role: 'user'
          }
        }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

  } catch (error) {
    // PG unique_violation code: 23505
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }
    logger.error(`Registration error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const userResult = await pool.query(
      'SELECT id, tenant_id, name, email, password_hash, role, is_super_admin FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const tenantResult = await pool.query(
      'SELECT onboarding_complete FROM tenants WHERE id = $1',
      [user.tenant_id]
    );
    const onboarding_complete = tenantResult.rows.length > 0 ? tenantResult.rows[0].onboarding_complete : false;

    const token = jwt.sign(
      {
        user_id: user.id,
        tenant_id: user.tenant_id,
        role: user.role,
        is_super_admin: user.is_super_admin || false
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          name: user.name,
          email: user.email,
          role: user.role,
          is_super_admin: user.is_super_admin || false,
          onboarding_complete
        }
      }
    });

  } catch (error) {
    logger.error(`Login error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }
    const userResult = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error(`Change password error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, error: 'Failed to change password' });
  }
}

module.exports = {
  register,
  login,
  changePassword,
};
