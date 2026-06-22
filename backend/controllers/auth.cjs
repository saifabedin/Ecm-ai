const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/client.cjs');

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
        [name, email.toLowerCase(), passwordHash, 'owner', tenantId]
      );
      await client.query('COMMIT');
      const user = userResult.rows[0];

      const token = jwt.sign(
        {
          user_id: user.id,
          tenant_id: user.tenant_id,
          role: 'owner'
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
            role: 'owner'
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
    console.error('Registration error:', error);
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
      'SELECT id, tenant_id, name, email, password_hash, role FROM users WHERE email = $1',
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

    const token = jwt.sign(
      {
        user_id: user.id,
        tenant_id: user.tenant_id,
        role: user.role
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
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
}

module.exports = {
  register,
  login
};
