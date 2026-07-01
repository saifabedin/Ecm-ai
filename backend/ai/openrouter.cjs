const dotenv = require("dotenv");
const path = require("path");

require('../initEnv.cjs');

const axios = require("axios");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function generateAIResponse({
  prompt,
  model = "openai/gpt-4o-mini",
  temperature = 0.7,
}) {
  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 120000, // 2 minutes
      }
    );

    const choice = response.data && response.data.choices && response.data.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error("OpenRouter returned empty response: " + JSON.stringify(response.data));
    }
    return choice.message.content;
  } catch (error) {
    console.error("❌ OpenRouter Error:", error.response?.data || error.message);
    throw new Error("AI generation failed: " + (error.message || 'unknown'));
  }
}

module.exports = {
  generateAIResponse
};
