const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");

require('../initEnv.cjs');

const BASE_URL = "https://graph.facebook.com/v19.0";

async function postToFacebook(videoUrl, caption) {
  try {
    const res = await axios.post(
      `${BASE_URL}/${process.env.META_PAGE_ID}/videos`,
      {
        file_url: videoUrl,
        description: caption,
        access_token: process.env.META_ACCESS_TOKEN,
      }
    );

    return res.data;
  } catch (err) {
    console.error("❌ FB Post Error:", err.response?.data || err.message);
    throw new Error("Facebook post failed");
  }
}

async function postToInstagram(imageUrl, caption) {
  try {
    // Step 1: Create media container
    const container = await axios.post(
      `${BASE_URL}/${process.env.META_IG_ID}/media`,
      {
        image_url: imageUrl,
        caption,
        access_token: process.env.META_ACCESS_TOKEN,
      }
    );

    // Step 2: Publish
    const publish = await axios.post(
      `${BASE_URL}/${process.env.META_IG_ID}/media_publish`,
      {
        creation_id: container.data.id,
        access_token: process.env.META_ACCESS_TOKEN,
      }
    );

    return publish.data;
} catch (err) {
console.error("❌ IG Post Error:", err.response?.data || err.message);
throw new Error("Instagram post failed");
}
}
