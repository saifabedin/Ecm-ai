const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateOpenAIResponse({ prompt, model = 'gpt-4o-mini', maxTokens = 2000, temperature = 0.7 } = {}) {
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('❌ OpenAI Text Error:', error);
    throw new Error('OpenAI text generation failed: ' + error.message);
  }
}

async function generateImageOpenAI(prompt) {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1024",
      response_format: "url",
    });

    const url = response.data[0]?.url;
    if (!url) throw new Error('No image URL in OpenAI response');
    return url;
} catch (error) {
console.error("❌ OpenAI Image Error:", error);
throw new Error("OpenAI image generation failed");
}
}

module.exports = {
  openai,
  generateOpenAIResponse,
  generateImageOpenAI,
};
