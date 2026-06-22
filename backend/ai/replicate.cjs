const dotenv = require("dotenv");
const path = require("path");

require('../initEnv.cjs');

const Replicate = require("replicate");

let replicate = null;
if (!process.env.REPLICATE_API_TOKEN) {
  console.warn('[replicate] REPLICATE_API_TOKEN missing — Replicate disabled');
} else {
  replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
}

async function pollUntilDone(predictionId, maxWaitMs = 180000) {
  const interval = 4000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const prediction = await replicate.predictions.get(predictionId);
    console.log("[Replicate] Status:", prediction.status);
    if (prediction.status === "succeeded") return prediction;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error("Prediction " + prediction.status + ": " + (prediction.error || "unknown"));
    }
    await new Promise((res) => setTimeout(res, interval));
  }
  throw new Error("Replicate timed out after 180s");
}

async function generateImage(prompt) {
  if (!replicate) throw new Error('Replicate is not configured (REPLICATE_API_TOKEN missing)');
  console.log("[Replicate] Generating:", prompt.slice(0, 80));

  const response = await fetch(
    "https://api.replicate.com/v1/models/wan-video/wan-2.7-image/predictions",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.REPLICATE_API_TOKEN,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: { prompt },
      }),
    }
  );

  let data;
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Replicate API ${response.status}: ${errText}`);
  }
  data = await response.json();
  console.log("[Replicate] Response status:", data.status);

  if (data.status === "succeeded" && data.output) {
    const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
    console.log("[Replicate] Image ready:", imageUrl);
    return imageUrl;
  }

  if (data.id && data.status !== "failed") {
    console.log("[Replicate] Polling:", data.id);
    const result = await pollUntilDone(data.id);
    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    console.log("[Replicate] Image ready:", imageUrl);
    return imageUrl;
  }

  throw new Error("Replicate error: " + (data.detail || data.error || JSON.stringify(data)));
}

module.exports = {
  generateImage
};
