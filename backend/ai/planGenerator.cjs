const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generatePlan(input) {
  try {
    const prompt = `
You are an AI Marketing Agent.

Create execution steps based on input:
${JSON.stringify(input)}

Return JSON:
{
  "steps": [
    {"action": "research"},
    {"action": "content"},
    {"action": "image"},
    {"action": "video"},
    {"action": "publish"},
    {"action": "ads"},
    {"action": "tracking"},
    {"action": "optimization"}
  ]
}
`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const data = JSON.parse(res.choices[0].message.content);

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  generatePlan
};