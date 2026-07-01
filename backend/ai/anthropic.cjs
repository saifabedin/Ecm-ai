const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Anthropic = require("@anthropic-ai/sdk");

// Initialize both Anthropic clients for load balancing
const anthropicClients = [];
let currentClientIndex = 0;

if (process.env.ANTHROPIC_API_KEY) {
  anthropicClients.push({
    client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    key: "ANTHROPIC_API_KEY",
    index: 0,
  });
}

if (process.env.ANTHROPIC_API_KEY_2) {
  anthropicClients.push({
    client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_2 }),
    key: "ANTHROPIC_API_KEY_2",
    index: 1,
  });
}

if (anthropicClients.length === 0) {
  console.warn("⚠️ No Anthropic API keys configured. Set ANTHROPIC_API_KEY or ANTHROPIC_API_KEY_2");
}

/**
 * Get next available Anthropic client (round-robin)
 */
function getNextClient() {
  if (anthropicClients.length === 0) {
    throw new Error("No Anthropic API keys configured");
  }
  
  const client = anthropicClients[currentClientIndex];
  currentClientIndex = (currentClientIndex + 1) % anthropicClients.length;
  
  console.log(`[Anthropic] Using client ${client.index + 1}/${anthropicClients.length} (${client.key})`);
  return client.client;
}

/**
 * Generate response using Claude (Anthropic)
 * @param {Object} options
 * @param {string} options.prompt - The prompt/message
 * @param {string} options.model - Model name (default: claude-3-5-sonnet-20241022)
 * @param {number} options.maxTokens - Max tokens (default: 1024)
 * @param {number} options.temperature - Temperature 0-1 (default: 0.7)
 * @returns {Promise<string>} Generated response
 */
async function generateClaudeResponse(options = {}) {
  const {
    prompt,
    model = "claude-3-5-sonnet-20241022",
    maxTokens = 1024,
    temperature = 0.7,
  } = options;

  if (!prompt) {
    throw new Error("Prompt is required");
  }

  try {
    const client = getNextClient();

    const message = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return message.content[0].type === "text" ? message.content[0].text : "";
  } catch (error) {
    console.error("❌ Anthropic Claude Error:", error.message);
    throw new Error(`Claude API failed: ${error.message}`);
  }
}

/**
 * Generate response with streaming support
 * @param {Object} options
 * @param {string} options.prompt - The prompt/message
 * @param {string} options.model - Model name
 * @param {Function} options.onChunk - Callback for stream chunks
 * @returns {Promise<string>} Full generated response
 */
async function generateClaudeResponseStream(options = {}) {
  const {
    prompt,
    model = "claude-3-5-sonnet-20241022",
    maxTokens = 1024,
    temperature = 0.7,
    onChunk = null,
  } = options;

  if (!prompt) {
    throw new Error("Prompt is required");
  }

  try {
    const client = getNextClient();
    let fullResponse = "";

    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        fullResponse += chunk.delta.text;
        if (onChunk) {
          onChunk(chunk.delta.text);
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error("❌ Anthropic Claude Streaming Error:", error.message);
    throw new Error(`Claude streaming API failed: ${error.message}`);
  }
}

module.exports = {
  generateClaudeResponse,
  generateClaudeResponseStream,
  getNextClient,
  getClientCount: () => anthropicClients.length,
};
