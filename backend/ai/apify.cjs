const axios = require("axios");

async function runApifyActor(actorId, input) {
  try {
    const response = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${process.env.APIFY_API_TOKEN}`,
      input
    );

    return response.data;
  } catch (error) {
    console.error("❌ Apify Error:", error.message);
    throw new Error("Scraping failed");
  }
}
