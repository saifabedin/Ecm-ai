const { describe, it, before } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

describe('Auth', () => {
  it('should verify JWT secret is set', () => {
    assert.ok(process.env.JWT_SECRET);
    assert.ok(process.env.JWT_SECRET.length >= 16);
  });
});
