const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '../../.env') });
const express = require('express');
const logger = require('../utils/logger.cjs');

const app = express();
app.use(express.json());

const MCP_API_KEY = process.env.MCP_API_KEY;
const MCP_PORT = process.env.MCP_PORT || 3000;

if (!MCP_API_KEY) {
  logger.error('[MCP] FATAL: MCP_API_KEY environment variable is not set. Refusing to start.');
  process.exit(1);
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }
  const token = authHeader.substring(7);
  if (token !== MCP_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mcp', timestamp: new Date().toISOString() });
});

app.post('/v1/tools/call', authenticate, (req, res) => {
  const { tool, arguments: args } = req.body;
  if (!tool) {
    return res.status(400).json({ error: 'Missing tool name' });
  }
  res.json({
    result: {
      tool,
      args,
      message: 'MCP tool call received',
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/v1/tools', authenticate, (req, res) => {
  res.json({
    tools: [
      { name: 'search', description: 'Search knowledge base' },
      { name: 'generate', description: 'Generate content' },
      { name: 'analyze', description: 'Analyze data' }
    ]
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(MCP_PORT, () => {
  logger.info(`MCP server listening on port ${MCP_PORT}`);
});
